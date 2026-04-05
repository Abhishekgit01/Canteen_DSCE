import { useEffect, useMemo, useState } from 'react';
import { pickupSettingsApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import './PickupSettingsPage.css';

const COLLEGE_OPTIONS = ['DSCE', 'NIE'] as const;

type CollegeOption = (typeof COLLEGE_OPTIONS)[number];

type PickupSettingsRecord = {
  college: CollegeOption;
  basePickupMinutes: number;
  rushHourExtra: number;
  perItemExtra: number;
  maxPickupMinutes: number;
  openingTime: string;
  closingTime: string;
  breakStart: string;
  breakEnd: string;
  hasBreak: boolean;
  isOpen: boolean;
  closedMessage: string;
  isCurrentlyOpen?: boolean;
  updatedAt?: string;
};

const resolveCollege = (value?: string | null): CollegeOption => (value === 'NIE' ? 'NIE' : 'DSCE');

const createDefaultSettings = (college: CollegeOption): PickupSettingsRecord => ({
  college,
  basePickupMinutes: 15,
  rushHourExtra: 10,
  perItemExtra: 2,
  maxPickupMinutes: 45,
  openingTime: college === 'NIE' ? '08:00' : '09:00',
  closingTime: college === 'NIE' ? '19:00' : '20:00',
  breakStart: '15:00',
  breakEnd: '16:00',
  hasBreak: false,
  isOpen: true,
  closedMessage: 'Canteen is currently closed',
});

function estimatePickup(
  baseMinutes: number,
  perItem: number,
  rushExtra: number,
  maxMinutes: number,
  itemCount: number,
  isRushHour: boolean,
) {
  let total = baseMinutes + perItem * itemCount;
  if (isRushHour) {
    total += rushExtra;
  }

  return Math.min(total, maxMinutes);
}

export default function PickupSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const managerCollege = resolveCollege(user?.college);
  const [selectedCollege, setSelectedCollege] = useState<CollegeOption>(managerCollege);
  const [settings, setSettings] = useState<PickupSettingsRecord>(() => createDefaultSettings(managerCollege));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setSelectedCollege(managerCollege);
  }, [managerCollege]);

  const activeCollege = isAdmin ? selectedCollege : managerCollege;

  useEffect(() => {
    void fetchSettings();
  }, [activeCollege]);

  const preview = useMemo(
    () => ({
      normal: estimatePickup(
        settings.basePickupMinutes,
        settings.perItemExtra,
        settings.rushHourExtra,
        settings.maxPickupMinutes,
        3,
        false,
      ),
      rush: estimatePickup(
        settings.basePickupMinutes,
        settings.perItemExtra,
        settings.rushHourExtra,
        settings.maxPickupMinutes,
        3,
        true,
      ),
      large: estimatePickup(
        settings.basePickupMinutes,
        settings.perItemExtra,
        settings.rushHourExtra,
        settings.maxPickupMinutes,
        10,
        true,
      ),
    }),
    [settings.basePickupMinutes, settings.maxPickupMinutes, settings.perItemExtra, settings.rushHourExtra],
  );

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setStatusMessage('');
      const response = await pickupSettingsApi.getPickupSettings(activeCollege);
      setSettings({
        ...createDefaultSettings(activeCollege),
        ...response,
        college: activeCollege,
      });
    } catch (error) {
      console.error('Failed to fetch pickup settings:', error);
      setStatusMessage('Could not load pickup settings right now.');
      setSettings(createDefaultSettings(activeCollege));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = <K extends keyof PickupSettingsRecord>(
    key: K,
    value: PickupSettingsRecord[K],
  ) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage('');

    try {
      const response = await pickupSettingsApi.updatePickupSettings(activeCollege, {
        basePickupMinutes: settings.basePickupMinutes,
        rushHourExtra: settings.rushHourExtra,
        perItemExtra: settings.perItemExtra,
        maxPickupMinutes: settings.maxPickupMinutes,
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        breakStart: settings.breakStart,
        breakEnd: settings.breakEnd,
        hasBreak: settings.hasBreak,
        isOpen: settings.isOpen,
        closedMessage: settings.closedMessage,
      });

      setSettings({
        ...settings,
        ...response,
        college: activeCollege,
      });
      setStatusMessage('Pickup settings saved.');
    } catch (error) {
      console.error('Failed to save pickup settings:', error);
      setStatusMessage('Could not save pickup settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pickup-settings-page">
      <div className="page-header pickup-settings-header">
        <div>
          <h1>Pickup Time Settings</h1>
          <p>
            Control service hours, pause ordering, and tune pickup estimates for {activeCollege}.
          </p>
        </div>

        {isAdmin ? (
          <select
            className="input pickup-settings-filter"
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

      {statusMessage ? <p className="pickup-settings-status">{statusMessage}</p> : null}

      {loading ? (
        <div className="card pickup-settings-loading">Loading pickup settings...</div>
      ) : (
        <form className="pickup-settings-grid" onSubmit={handleSave}>
          <section className="card pickup-settings-card">
            <div className="pickup-settings-card-head">
              <h2>Canteen Status</h2>
              <span className={`pickup-live-pill ${settings.isCurrentlyOpen ? 'open' : 'closed'}`}>
                {settings.isCurrentlyOpen ? 'Open now' : 'Closed now'}
              </span>
            </div>

            <label className="pickup-checkbox">
              <input
                type="checkbox"
                checked={settings.isOpen}
                onChange={(event) => handleChange('isOpen', event.target.checked)}
              />
              <span>Allow orders right now</span>
            </label>

            <label className="pickup-field">
              <span>Closed message</span>
              <input
                className="input"
                value={settings.closedMessage}
                onChange={(event) => handleChange('closedMessage', event.target.value)}
              />
            </label>
          </section>

          <section className="card pickup-settings-card">
            <div className="pickup-settings-card-head">
              <h2>Opening Hours</h2>
            </div>

            <div className="pickup-time-grid">
              <label className="pickup-field">
                <span>Opens</span>
                <input
                  className="input"
                  type="time"
                  value={settings.openingTime}
                  onChange={(event) => handleChange('openingTime', event.target.value)}
                />
              </label>

              <label className="pickup-field">
                <span>Closes</span>
                <input
                  className="input"
                  type="time"
                  value={settings.closingTime}
                  onChange={(event) => handleChange('closingTime', event.target.value)}
                />
              </label>
            </div>

            <label className="pickup-checkbox">
              <input
                type="checkbox"
                checked={settings.hasBreak}
                onChange={(event) => handleChange('hasBreak', event.target.checked)}
              />
              <span>Enable break window</span>
            </label>

            <div className="pickup-time-grid">
              <label className="pickup-field">
                <span>Break starts</span>
                <input
                  className="input"
                  type="time"
                  value={settings.breakStart}
                  onChange={(event) => handleChange('breakStart', event.target.value)}
                  disabled={!settings.hasBreak}
                />
              </label>

              <label className="pickup-field">
                <span>Break ends</span>
                <input
                  className="input"
                  type="time"
                  value={settings.breakEnd}
                  onChange={(event) => handleChange('breakEnd', event.target.value)}
                  disabled={!settings.hasBreak}
                />
              </label>
            </div>
          </section>

          <section className="card pickup-settings-card">
            <div className="pickup-settings-card-head">
              <h2>Pickup Estimates</h2>
            </div>

            <div className="pickup-number-grid">
              <label className="pickup-field">
                <span>Base wait time</span>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={120}
                  value={settings.basePickupMinutes}
                  onChange={(event) => handleChange('basePickupMinutes', Number(event.target.value))}
                />
              </label>

              <label className="pickup-field">
                <span>Extra per item</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={10}
                  value={settings.perItemExtra}
                  onChange={(event) => handleChange('perItemExtra', Number(event.target.value))}
                />
              </label>

              <label className="pickup-field">
                <span>Rush hour extra</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={60}
                  value={settings.rushHourExtra}
                  onChange={(event) => handleChange('rushHourExtra', Number(event.target.value))}
                />
              </label>

              <label className="pickup-field">
                <span>Maximum cap</span>
                <input
                  className="input"
                  type="number"
                  min={10}
                  max={120}
                  value={settings.maxPickupMinutes}
                  onChange={(event) => handleChange('maxPickupMinutes', Number(event.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="card pickup-settings-card pickup-preview-card">
            <div className="pickup-settings-card-head">
              <h2>Live Preview</h2>
            </div>

            <div className="pickup-preview-list">
              <div className="pickup-preview-row">
                <span>Normal order (3 items)</span>
                <strong>~{preview.normal} min</strong>
              </div>
              <div className="pickup-preview-row">
                <span>Rush hour order (3 items)</span>
                <strong>~{preview.rush} min</strong>
              </div>
              <div className="pickup-preview-row">
                <span>Large order (10 items)</span>
                <strong>~{preview.large} min</strong>
              </div>
            </div>

            <p className="pickup-settings-meta">
              {settings.updatedAt
                ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}`
                : 'Save once to publish these settings to the student app.'}
            </p>
          </section>

          <div className="pickup-settings-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
