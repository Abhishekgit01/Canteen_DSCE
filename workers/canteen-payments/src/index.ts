type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Env = {
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  ATLAS_DATA_API_URL: string;
  ATLAS_DATA_API_KEY: string;
  ATLAS_DATA_SOURCE?: string;
  ATLAS_DB: string;
  ATLAS_COLLECTION_ORDERS: string;
  INTERNAL_SECRET: string;
  RENDER_INTERNAL_URL: string;
  QR_SECRET: string;
};

type AtlasOrderDocument = {
  _id?: unknown;
  userId?: unknown;
  totalAmount?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  razorpayOrderId?: unknown;
  razorpayPaymentId?: unknown;
  qrTokenHash?: unknown;
  qrExpiresAt?: unknown;
  webhookVerified?: unknown;
};

const QR_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const JSON_HEADERS = {
  'Content-Type': 'application/json',
};
const FINALIZED_STATUSES = new Set(['paid', 'preparing', 'ready', 'fulfilled']);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function okResponse() {
  return new Response('OK', { status: 200 });
}

function getConfirmPathOrderId(pathname: string) {
  return pathname.match(/^\/api\/orders\/([^/]+)\/confirm-razorpay$/)?.[1] ?? null;
}

function normalizeId(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    '$oid' in value &&
    typeof (value as { $oid?: unknown }).$oid === 'string'
  ) {
    return (value as { $oid: string }).$oid;
  }

  return String(value ?? '');
}

function normalizeDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (
    value &&
    typeof value === 'object' &&
    '$date' in value &&
    typeof (value as { $date?: unknown }).$date === 'string'
  ) {
    return normalizeDate((value as { $date: string }).$date);
  }

  return null;
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value);
}

function toAtlasObjectId(id: string) {
  return { $oid: id };
}

function getAtlasOrderFilter(order: AtlasOrderDocument) {
  const orderId = normalizeId(order._id);
  if (/^[a-f0-9]{24}$/i.test(orderId)) {
    return { _id: toAtlasObjectId(orderId) };
  }

  return { razorpayOrderId: order.razorpayOrderId };
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeBytesBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signHmac(secret: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return new Uint8Array(signature);
}

async function verifyHMAC(secret: string, body: string, signature: string): Promise<boolean> {
  const computed = toHex(await signHmac(secret, body));
  return computed === signature;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

async function buildQrToken(
  order: AtlasOrderDocument,
  env: Env,
  expiresAt = new Date(Date.now() + QR_TOKEN_TTL_MS),
) {
  const payload = {
    orderId: normalizeId(order._id),
    userId: normalizeId(order.userId),
    amount: normalizeNumber(order.totalAmount),
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const encodedHeader = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(env.QR_SECRET, signingInput);
  const qrToken = `${signingInput}.${encodeBytesBase64Url(signature)}`;

  return {
    qrToken,
    qrTokenHash: await sha256Hex(qrToken),
    expiresAt,
  };
}

async function getExistingQrToken(order: AtlasOrderDocument, env: Env) {
  const qrExpiresAt = normalizeDate(order.qrExpiresAt);
  if (!order.qrTokenHash || !qrExpiresAt || qrExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  const { qrToken, qrTokenHash } = await buildQrToken(order, env, qrExpiresAt);
  if (qrTokenHash !== order.qrTokenHash) {
    return null;
  }

  return qrToken;
}

async function atlasRequest<TResponse>(env: Env, action: string, payload: Record<string, unknown>) {
  const response = await fetch(`${env.ATLAS_DATA_API_URL}/action/${action}`, {
    method: 'POST',
    headers: {
      'api-key': env.ATLAS_DATA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataSource: env.ATLAS_DATA_SOURCE || 'Cluster0',
      database: env.ATLAS_DB,
      collection: env.ATLAS_COLLECTION_ORDERS,
      ...payload,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Atlas ${action} failed (${response.status}): ${message}`);
  }

  return (await response.json()) as TResponse;
}

async function atlasFind(env: Env, filter: Record<string, unknown>) {
  return atlasRequest<{ document?: AtlasOrderDocument | null }>(env, 'findOne', { filter });
}

async function atlasUpdate(
  env: Env,
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
) {
  return atlasRequest<{ matchedCount?: number; modifiedCount?: number }>(env, 'updateOne', {
    filter,
    update,
  });
}

async function findOrderByRazorpayOrderId(env: Env, razorpayOrderId: string) {
  const result = await atlasFind(env, { razorpayOrderId });
  return result.document ?? null;
}

async function emitInternal(env: Env, event: string, payload: Record<string, unknown>) {
  await fetch(`${env.RENDER_INTERNAL_URL}/internal/emit`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      secret: env.INTERNAL_SECRET,
      event,
      payload,
    }),
  });
}

async function finalizeRazorpayOrder(
  env: Env,
  order: AtlasOrderDocument,
  options: {
    razorpayPaymentId?: string;
    verified?: boolean;
  } = {},
) {
  const filter = getAtlasOrderFilter(order);
  const orderId = normalizeId(order._id);
  const updates: Record<string, unknown> = {};
  let qrToken = await getExistingQrToken(order, env);

  if (options.razorpayPaymentId && !order.razorpayPaymentId) {
    updates.razorpayPaymentId = options.razorpayPaymentId;
  }

  if (options.verified && !order.webhookVerified) {
    updates.webhookVerified = true;
  }

  if (!FINALIZED_STATUSES.has(String(order.status))) {
    const generatedToken = await buildQrToken(order, env);
    qrToken = generatedToken.qrToken;

    Object.assign(updates, {
      status: 'paid',
      paymentStatus: 'completed',
      paymentMethod: 'razorpay',
      paidAt: { $date: new Date().toISOString() },
      qrTokenHash: generatedToken.qrTokenHash,
      qrExpiresAt: { $date: generatedToken.expiresAt.toISOString() },
    });
  } else if (!qrToken) {
    const generatedToken = await buildQrToken(order, env);
    qrToken = generatedToken.qrToken;

    Object.assign(updates, {
      qrTokenHash: generatedToken.qrTokenHash,
      qrExpiresAt: { $date: generatedToken.expiresAt.toISOString() },
    });
  }

  if (Object.keys(updates).length > 0) {
    await atlasUpdate(env, filter, { $set: updates });
  }

  return {
    orderId,
    qrToken,
  };
}

async function markOrderFailed(
  env: Env,
  order: AtlasOrderDocument,
  razorpayPaymentId?: string,
) {
  if (FINALIZED_STATUSES.has(String(order.status)) || String(order.status) === 'failed') {
    return { orderId: normalizeId(order._id) };
  }

  const updates: Record<string, unknown> = {
    status: 'failed',
    paymentStatus: 'failed',
    paymentMethod: 'razorpay',
  };

  if (razorpayPaymentId && !order.razorpayPaymentId) {
    updates.razorpayPaymentId = razorpayPaymentId;
  }

  await atlasUpdate(env, getAtlasOrderFilter(order), { $set: updates });

  return {
    orderId: normalizeId(order._id),
  };
}

async function handleWebhook(request: Request, env: Env, ctx: WorkerExecutionContext) {
  const signature = request.headers.get('x-razorpay-signature');
  const rawBody = await request.arrayBuffer();
  const body = new TextDecoder().decode(rawBody);

  if (!signature || !env.RAZORPAY_WEBHOOK_SECRET) {
    return okResponse();
  }

  const isValid = await verifyHMAC(env.RAZORPAY_WEBHOOK_SECRET, body, signature);
  if (!isValid) {
    console.error('Rejected Razorpay webhook due to invalid signature');
    return okResponse();
  }

  let event: any;

  try {
    event = JSON.parse(body);
  } catch (error) {
    console.error('Failed to parse Razorpay webhook payload', error);
    return okResponse();
  }

  ctx.waitUntil(
    (async () => {
      const payment = event?.payload?.payment?.entity;
      const razorpayOrderId = payment?.order_id;
      const razorpayPaymentId = payment?.id;

      if (!razorpayOrderId) {
        return;
      }

      const order = await findOrderByRazorpayOrderId(env, razorpayOrderId);
      if (!order) {
        return;
      }

      if (event?.event === 'payment.captured') {
        const finalized = await finalizeRazorpayOrder(env, order, {
          razorpayPaymentId,
          verified: true,
        });

        if (finalized.qrToken) {
          await emitInternal(env, 'order:paid', {
            orderId: finalized.orderId,
            qrToken: finalized.qrToken,
          });
        }

        return;
      }

      if (event?.event === 'payment.failed') {
        const failed = await markOrderFailed(env, order, razorpayPaymentId);
        await emitInternal(env, 'order:failed', { orderId: failed.orderId });
      }
    })().catch((error) => {
      console.error('Failed to process Razorpay webhook event', error);
    }),
  );

  return okResponse();
}

async function handleConfirmRazorpay(
  request: Request,
  env: Env,
  ctx: WorkerExecutionContext,
  requestedOrderId: string,
) {
  let body: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Payment verification failed' }, 400);
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return jsonResponse({ error: 'Payment verification failed' }, 400);
  }

  const isValid = await verifyHMAC(
    env.RAZORPAY_KEY_SECRET,
    `${razorpay_order_id}|${razorpay_payment_id}`,
    razorpay_signature,
  );

  if (!isValid) {
    console.error('Razorpay signature mismatch', {
      orderId: requestedOrderId,
      razorpayOrderId: razorpay_order_id,
    });
    return jsonResponse({ error: 'Payment verification failed' }, 400);
  }

  const order = await findOrderByRazorpayOrderId(env, razorpay_order_id);
  if (!order) {
    return jsonResponse({ error: 'Order not found' }, 404);
  }

  if (normalizeId(order._id) !== requestedOrderId) {
    console.error('Razorpay order mismatch during confirmation', {
      orderId: requestedOrderId,
      razorpayOrderId: razorpay_order_id,
    });
    return jsonResponse({ error: 'Payment verification failed' }, 400);
  }

  const finalized = await finalizeRazorpayOrder(env, order, {
    razorpayPaymentId: razorpay_payment_id,
    verified: true,
  });

  if (finalized.qrToken) {
    ctx.waitUntil(
      emitInternal(env, 'order:paid', {
        orderId: finalized.orderId,
        qrToken: finalized.qrToken,
      }).catch((error) => {
        console.error('Failed to emit order:paid event', error);
      }),
    );
  }

  return jsonResponse({
    orderId: finalized.orderId,
    qrToken: finalized.qrToken,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/webhook/razorpay') {
      return handleWebhook(request, env, ctx);
    }

    const confirmOrderId = getConfirmPathOrderId(url.pathname);
    if (request.method === 'POST' && confirmOrderId) {
      return handleConfirmRazorpay(request, env, ctx, confirmOrderId);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
