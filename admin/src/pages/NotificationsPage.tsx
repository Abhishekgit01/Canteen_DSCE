import { useEffect, useMemo, useState } from 'react';
import { menuApi, notificationsApi, rushHoursApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import './NotificationsPage.css';

type CollegeOption = 'DSCE' | 'NIE';

type MenuItemOption = {
  _id: string;
  name: string;
  price: number;
  college?: string;
};

type HistoryItem = {
  _id: string;
  type: 'broadcast' | 'daily_special' | 'rush_warning';
  title: string;
  body: string;
  college?: string;
  recipientCount: number;
  createdAt: string;
  menuItemId?: { name?: string } | null;
  senderId?: { name?: string; role?: string } | null;
};

const COLLEGE_OPTIONS: CollegeOption[] = ['DSCE', 'NIE'];

const resolveCollege = (value?: string | null): CollegeOption => (value === 'NIE' ? 'NIE' : 'DSCE');

export default function NotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const managerCollege = resolveCollege(user?.college);
  const [selectedCollege, setSelectedCollege] = useState<CollegeOption>(managerCollege);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [broadcastType, setBroadcastType] = useState<'broadcast' | 'rush_warning'>('broadcast');
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [dailySpecialId, setDailySpecialId] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [rushPreview, setRushPreview] = useState<{
    current?: { label: string; endTime: string; message: string } | null;
    all?: Array<{ label: string; endTime: string; message: string }>;
  } | null>(null);

  useEffect(() => {
    setSelectedCollege(managerCollege);
  }, [managerCollege]);

  useEffect(() => {
    void Promise.all([fetchMenu(), fetchHistory(), fetchRushPreview()]);
  }, [selectedCollege, user?.college, user?.role]);

  const selectedSpecial = useMemo(
    () => menuItems.find((item) => item._id === dailySpecialId) || null,
    [dailySpecialId, menuItems],
  );

  const previewTitle = title.trim() || 'Notification title';
  const previewBody = body.trim() || 'Message preview will appear here.';

  const fetchMenu = async () => {
    try {
      const response = await menuApi.getMenu(isAdmin ? selectedCollege : managerCollege);
      setMenuItems(response.data);

      setDailySpecialId((current) => {
        if (current && response.data.some((item: MenuItemOption) => item._id === current)) {
          return current;
        }

        return response.data[0]?._id || '';
      });
    } catch (error) {
      console.error('Failed to fetch menu for notifications:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await notificationsApi.getHistory(isAdmin ? selectedCollege : undefined);
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch notification history:', error);
    }
  };

  const fetchRushPreview = async () => {
    try {
      const response = await rushHoursApi.getRushHourStatus(isAdmin ? selectedCollege : managerCollege);
      setRushPreview(response.data);
    } catch (error) {
      console.error('Failed to fetch rush preview:', error);
      setRushPreview(null);
    }
  };

  const handleBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      setStatusMessage('Add both a title and a message before sending.');
      return;
    }

    setIsSending(true);
    setStatusMessage('');

    try {
      const response = await notificationsApi.broadcast({
        title: title.trim(),
        body: body.trim(),
        college: isAdmin ? selectedCollege : undefined,
        type: broadcastType,
      });

      setStatusMessage(`${response.data.recipients} students queued for this notification.`);
      await fetchHistory();
    } catch (error) {
      console.error('Failed to send broadcast:', error);
      setStatusMessage('Could not send the notification right now.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDailySpecial = async () => {
    if (!dailySpecialId) {
      setStatusMessage('Pick a menu item to announce as the daily special.');
      return;
    }

    setIsSending(true);
    setStatusMessage('');

    try {
      const response = await notificationsApi.announceDailySpecial(dailySpecialId);
      setStatusMessage(`${response.data.recipients} students will see the daily special.`);
      await fetchHistory();
    } catch (error) {
      console.error('Failed to announce daily special:', error);
      setStatusMessage('Could not announce the daily special.');
    } finally {
      setIsSending(false);
    }
  };

  const fillRushTemplate = () => {
    const nextRush = rushPreview?.current || rushPreview?.all?.[0];

    if (!nextRush) {
      setStatusMessage('No rush hour window is configured yet for this college.');
      return;
    }

    setBroadcastType('rush_warning');
    setTitle(`Rush hour at ${selectedCollege}`);
    setBody(`${nextRush.message} Rush hour runs until ${nextRush.endTime}.`);
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div>
          <h1>Send Notifications</h1>
          <p>
            Reach students at the right college with quick broadcasts, rush warnings, and daily
            specials.
          </p>
        </div>

        {isAdmin ? (
          <select
            className="input notifications-college-filter"
            value={selectedCollege}
            onChange={(event) => setSelectedCollege(resolveCollege(event.target.value))}
          >
            {COLLEGE_OPTIONS.map((college) => (
              <option key={college} value={college}>
                {college}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="notifications-grid">
        <section className="card notifications-panel">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                setBroadcastType('broadcast');
                setTitle(`Hello ${selectedCollege} students`);
                setBody('Fresh batches are live now. Open the app to order before the canteen gets busy.');
              }}
            >
              Custom Broadcast
            </button>
            <button className="btn btn-secondary" onClick={fillRushTemplate}>
              Rush Warning
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!selectedSpecial) {
                  setStatusMessage('Pick a daily special item first.');
                  return;
                }

                setTitle(`Today's Special at ${selectedCollege}`);
                setBody(`${selectedSpecial.name} is live for Rs.${selectedSpecial.price}. Available while it lasts.`);
              }}
            >
              Daily Special Copy
            </button>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Notification title"
            />
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea
              className="input notifications-textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write the message students should receive"
            />
          </div>

          <div className="preview-card">
            <span className="preview-label">Preview</span>
            <div className="phone-preview">
              <div className="phone-preview-title">{previewTitle}</div>
              <div className="phone-preview-body">{previewBody}</div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => void handleBroadcast()} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send notification'}
          </button>
        </section>

        <section className="card notifications-panel">
          <h2>Daily Special</h2>
          <div className="form-group">
            <label>Pick item</label>
            <select
              className="input"
              value={dailySpecialId}
              onChange={(event) => setDailySpecialId(event.target.value)}
            >
              {menuItems.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} - Rs.{item.price}
                </option>
              ))}
            </select>
          </div>

          {selectedSpecial ? (
            <div className="special-preview">
              <strong>{selectedSpecial.name}</strong>
              <span>College: {selectedCollege}</span>
              <span>Price: Rs.{selectedSpecial.price}</span>
            </div>
          ) : null}

          <button className="btn btn-primary" onClick={() => void handleDailySpecial()} disabled={isSending}>
            {isSending ? 'Sending...' : "Announce today's special"}
          </button>

          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </section>
      </div>

      <section className="card notifications-history">
        <div className="history-header">
          <h2>Sent History</h2>
          <button className="btn btn-secondary" onClick={() => void fetchHistory()}>
            Refresh
          </button>
        </div>

        <div className="history-list">
          {history.map((entry) => (
            <div key={entry._id} className="history-item">
              <div className="history-item-top">
                <span className={`history-type history-type-${entry.type}`}>{entry.type.replace('_', ' ')}</span>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <strong>{entry.title}</strong>
              <p>{entry.body}</p>
              <div className="history-meta">
                <span>{entry.college || selectedCollege}</span>
                <span>{entry.recipientCount} recipients</span>
                <span>{entry.menuItemId?.name ? `Item: ${entry.menuItemId.name}` : 'Broadcast'}</span>
                <span>{entry.senderId?.name ? `By ${entry.senderId.name}` : 'System'}</span>
              </div>
            </div>
          ))}

          {history.length === 0 ? <p className="history-empty">No notification history yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
