import { useEffect, useState } from 'react';
import { rushHoursApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import './RushHours.css';

const COLLEGE_OPTIONS = ['DSCE', 'NIE'] as const;
const DAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

type CollegeOption = (typeof COLLEGE_OPTIONS)[number];

type RushHour = {
  _id: string;
  college: string;
  dayOfWeek: number[];
  endTime: string;
  isActive: boolean;
  label: string;
  message: string;
  startTime: string;
  surchargePercent: number;
};

type RushHourStatusResponse = {
  isRushHour: boolean;
  current: RushHour | null;
  all: RushHour[];
};

type RushHourFormState = {
  college: CollegeOption;
  dayOfWeek: number[];
  endTime: string;
  isActive: boolean;
  label: string;
  message: string;
  startTime: string;
  surchargePercent: number;
};

const resolveCollege = (value?: string | null): CollegeOption => (value === 'NIE' ? 'NIE' : 'DSCE');

const createEmptyForm = (college: CollegeOption): RushHourFormState => ({
  college,
  dayOfWeek: [1, 2, 3, 4, 5],
  endTime: '14:00',
  isActive: true,
  label: '',
  message: 'Busy hours — expect slight delays',
  startTime: '12:00',
  surchargePercent: 0,
});

const formatDays = (days: number[]) => {
  const labels = DAY_OPTIONS.filter((day) => days.includes(day.value)).map((day) => day.label);
  return labels.length > 0 ? labels.join(', ') : 'No days selected';
};

export default function RushHoursPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const managerCollege = resolveCollege(user?.college);
  const [selectedCollege, setSelectedCollege] = useState<CollegeOption>(managerCollege);
  const [rushHours, setRushHours] = useState<RushHour[]>([]);
  const [statusPreview, setStatusPreview] = useState<RushHourStatusResponse | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<RushHourFormState>(() => createEmptyForm(managerCollege));

  useEffect(() => {
    setSelectedCollege(managerCollege);
    setFormData((current) => ({
      ...current,
      college: current.college || managerCollege,
    }));
  }, [managerCollege]);

  const activeCollege = isAdmin ? selectedCollege : managerCollege;

  const loadRushHours = async () => {
    setLoading(true);
    setError('');

    try {
      const [hoursResponse, statusResponse] = await Promise.all([
        rushHoursApi.getRushHours(activeCollege),
        rushHoursApi.getRushHourStatus(activeCollege),
      ]);
      setRushHours(hoursResponse.data);
      setStatusPreview(statusResponse.data);
    } catch (err: any) {
      console.error('Failed to fetch rush hours:', err);
      setError(err?.response?.data?.error || 'Failed to load rush-hour settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRushHours();
  }, [activeCollege]);

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingId(null);
    setFormData(createEmptyForm(activeCollege));
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(createEmptyForm(activeCollege));
    setIsEditorOpen(true);
  };

  const openEdit = (rushHour: RushHour) => {
    setEditingId(rushHour._id);
    setFormData({
      college: resolveCollege(rushHour.college),
      dayOfWeek: rushHour.dayOfWeek,
      endTime: rushHour.endTime,
      isActive: rushHour.isActive,
      label: rushHour.label,
      message: rushHour.message,
      startTime: rushHour.startTime,
      surchargePercent: rushHour.surchargePercent,
    });
    setIsEditorOpen(true);
  };

  const handleDayToggle = (value: number) => {
    setFormData((current) => {
      const dayOfWeek = current.dayOfWeek.includes(value)
        ? current.dayOfWeek.filter((day) => day !== value)
        : [...current.dayOfWeek, value].sort((a, b) => a - b);

      return {
        ...current,
        dayOfWeek,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const payload = {
        ...formData,
        college: isAdmin ? formData.college : managerCollege,
        surchargePercent: Number(formData.surchargePercent),
      };

      if (editingId) {
        await rushHoursApi.updateRushHour(editingId, payload);
      } else {
        await rushHoursApi.createRushHour(payload);
      }

      closeEditor();
      await loadRushHours();
    } catch (err: any) {
      console.error('Failed to save rush hour:', err);
      setError(err?.response?.data?.error || 'Failed to save rush-hour settings');
    }
  };

  const handleToggleActive = async (rushHour: RushHour) => {
    try {
      await rushHoursApi.updateRushHour(rushHour._id, { isActive: !rushHour.isActive });
      await loadRushHours();
    } catch (err: any) {
      console.error('Failed to toggle rush hour:', err);
      setError(err?.response?.data?.error || 'Failed to update rush-hour status');
    }
  };

  const handleDelete = async (rushHourId: string) => {
    if (!window.confirm('Delete this rush-hour window?')) {
      return;
    }

    try {
      await rushHoursApi.deleteRushHour(rushHourId);
      await loadRushHours();
    } catch (err: any) {
      console.error('Failed to delete rush hour:', err);
      setError(err?.response?.data?.error || 'Failed to delete rush-hour window');
    }
  };

  return (
    <div className="rush-hours-page">
      <div className="page-header">
        <div>
          <h1>Rush Hours</h1>
          <p className="rush-hours-subtitle">
            Adjust busy windows, student-facing messages, and temporary surcharge notices for{' '}
            {activeCollege}.
          </p>
        </div>
        <div className="rush-hours-actions">
          {isAdmin ? (
            <select
              className="input rush-hours-filter"
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
          <button className="btn btn-primary" onClick={openCreate}>
            Add Rush Hour
          </button>
        </div>
      </div>

      {error ? <p className="rush-hours-error">{error}</p> : null}

      <section className={`rush-status-card ${statusPreview?.isRushHour ? 'active' : ''}`}>
        <span className="rush-status-eyebrow">Live status</span>
        {statusPreview?.isRushHour && statusPreview.current ? (
          <>
            <h2>{statusPreview.current.label}</h2>
            <p>{statusPreview.current.message}</p>
            <div className="rush-status-meta">
              <span>
                {statusPreview.current.startTime} - {statusPreview.current.endTime}
              </span>
              <span>
                {statusPreview.current.surchargePercent > 0
                  ? `+${statusPreview.current.surchargePercent}% surcharge`
                  : 'No surcharge'}
              </span>
            </div>
          </>
        ) : (
          <>
            <h2>No active rush hour</h2>
            <p>{activeCollege} is currently running in its normal service window.</p>
          </>
        )}
      </section>

      {loading ? (
        <div className="card rush-empty-state">Loading rush-hour windows...</div>
      ) : rushHours.length === 0 ? (
        <div className="card rush-empty-state">
          No rush-hour windows are configured yet for {activeCollege}.
        </div>
      ) : (
        <div className="rush-hours-grid">
          {rushHours.map((rushHour) => (
            <article
              key={rushHour._id}
              className={`rush-hour-card ${rushHour.isActive ? '' : 'muted'}`}
            >
              <div className="rush-hour-card-header">
                <div>
                  <h3>{rushHour.label}</h3>
                  <p>{formatDays(rushHour.dayOfWeek)}</p>
                </div>
                <span className={`rush-hour-pill ${rushHour.isActive ? 'active' : 'inactive'}`}>
                  {rushHour.isActive ? 'Active' : 'Paused'}
                </span>
              </div>

              <p className="rush-hour-time">
                {rushHour.startTime} - {rushHour.endTime}
              </p>
              <p className="rush-hour-message">{rushHour.message}</p>

              <div className="rush-hour-footer">
                <span>
                  {rushHour.surchargePercent > 0
                    ? `+${rushHour.surchargePercent}% surcharge`
                    : 'No surcharge'}
                </span>
                <span>{resolveCollege(rushHour.college)}</span>
              </div>

              <div className="rush-hour-actions-row">
                <button className="btn btn-secondary" onClick={() => void handleToggleActive(rushHour)}>
                  {rushHour.isActive ? 'Pause' : 'Resume'}
                </button>
                <button className="btn btn-secondary" onClick={() => openEdit(rushHour)}>
                  Edit
                </button>
                <button
                  className="btn btn-secondary danger"
                  onClick={() => void handleDelete(rushHour._id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isEditorOpen ? (
        <div className="modal">
          <div className="modal-content rush-hours-modal">
            <h2>{editingId ? 'Edit Rush Hour' : 'Add Rush Hour'}</h2>
            <form className="rush-hours-form" onSubmit={handleSubmit}>
              <input
                className="input"
                placeholder="Label"
                value={formData.label}
                onChange={(event) => setFormData({ ...formData, label: event.target.value })}
                required
              />

              {isAdmin ? (
                <select
                  className="input"
                  value={formData.college}
                  onChange={(event) =>
                    setFormData({ ...formData, college: resolveCollege(event.target.value) })
                  }
                >
                  {COLLEGE_OPTIONS.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="rush-hours-time-row">
                <label className="rush-hours-field">
                  <span>Start</span>
                  <input
                    className="input"
                    type="time"
                    value={formData.startTime}
                    onChange={(event) =>
                      setFormData({ ...formData, startTime: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="rush-hours-field">
                  <span>End</span>
                  <input
                    className="input"
                    type="time"
                    value={formData.endTime}
                    onChange={(event) => setFormData({ ...formData, endTime: event.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="rush-hours-field">
                <span>Days</span>
                <div className="day-chip-row">
                  {DAY_OPTIONS.map((day) => {
                    const active = formData.dayOfWeek.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        className={`day-chip ${active ? 'active' : ''}`}
                        onClick={() => handleDayToggle(day.value)}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="rush-hours-field">
                <span>Student message</span>
                <textarea
                  className="input rush-hours-textarea"
                  value={formData.message}
                  onChange={(event) => setFormData({ ...formData, message: event.target.value })}
                  rows={3}
                />
              </label>

              <label className="rush-hours-field">
                <span>Surcharge percent</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={50}
                  value={formData.surchargePercent}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      surchargePercent: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className="rush-hours-checkbox">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(event) =>
                    setFormData({ ...formData, isActive: event.target.checked })
                  }
                />
                <span>Rush hour is active</span>
              </label>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save Changes' : 'Create Rush Hour'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeEditor}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
