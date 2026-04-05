import { useEffect, useMemo, useState } from 'react';
import { menuApi, reviewsApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import './ReviewsPage.css';

type CollegeOption = 'DSCE' | 'NIE';

type ReviewRecord = {
  id: string;
  menuItemId: string;
  menuItem?: {
    id: string;
    name: string;
  };
  student?: {
    id: string;
    name: string;
    college?: string;
    email?: string;
  };
  college?: string;
  rating: number;
  title: string;
  body: string;
  tags: string[];
  helpful: number;
  isVerified: boolean;
  isVisible: boolean;
  createdAt: string;
};

type MenuItemSummary = {
  _id?: string;
  id?: string;
  name: string;
  averageRating?: number;
  totalReviews?: number;
};

const COLLEGE_OPTIONS: CollegeOption[] = ['DSCE', 'NIE'];

const resolveCollege = (value?: string | null): CollegeOption => (value === 'NIE' ? 'NIE' : 'DSCE');

export default function ReviewsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const managerCollege = resolveCollege(user?.college);
  const [selectedCollege, setSelectedCollege] = useState<CollegeOption>(managerCollege);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('all');
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setSelectedCollege(managerCollege);
  }, [managerCollege]);

  useEffect(() => {
    void fetchData();
  }, [selectedCollege, visibilityFilter, selectedMenuItemId, user?.college, user?.role]);

  const topRatedItems = useMemo(
    () =>
      [...menuItems]
        .filter((item) => (item.totalReviews || 0) > 0)
        .sort((left, right) => {
          const rightScore = (right.averageRating || 0) * (right.totalReviews || 0);
          const leftScore = (left.averageRating || 0) * (left.totalReviews || 0);
          return rightScore - leftScore;
        })
        .slice(0, 5),
    [menuItems],
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      setStatusMessage('');

      const college = isAdmin ? selectedCollege : managerCollege;
      const [menuResponse, reviewResponse] = await Promise.all([
        menuApi.getMenu(college),
        reviewsApi.getAll({
          college: isAdmin ? selectedCollege : undefined,
          menuItemId: selectedMenuItemId !== 'all' ? selectedMenuItemId : undefined,
          isVisible:
            visibilityFilter === 'all'
              ? undefined
              : visibilityFilter === 'visible',
        }),
      ]);

      setMenuItems(menuResponse.data);
      setReviews(reviewResponse);
    } catch (error) {
      console.error('Failed to fetch reviews dashboard:', error);
      setStatusMessage('Could not load the reviews dashboard right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (review: ReviewRecord) => {
    try {
      await reviewsApi.toggleVisibility(review.id, !review.isVisible);
      setStatusMessage(review.isVisible ? 'Review hidden from students.' : 'Review is visible again.');
      await fetchData();
    } catch (error) {
      console.error('Failed to update review visibility:', error);
      setStatusMessage('Could not update review visibility.');
    }
  };

  return (
    <div className="reviews-page">
      <div className="reviews-header">
        <div>
          <h1>Reviews Management</h1>
          <p>
            Track what students love, spot weak items quickly, and hide anything that should not be
            shown publicly.
          </p>
        </div>

        {isAdmin ? (
          <select
            className="input reviews-college-filter"
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

      <div className="reviews-toolbar card">
        <div className="reviews-toolbar-group">
          <label>Menu item</label>
          <select
            className="input"
            value={selectedMenuItemId}
            onChange={(event) => setSelectedMenuItemId(event.target.value)}
          >
            <option value="all">All menu items</option>
            {menuItems.map((item) => (
              <option key={item.id || item._id} value={item.id || item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="reviews-toolbar-group">
          <label>Visibility</label>
          <div className="visibility-filters">
            {[
              { key: 'all', label: 'All' },
              { key: 'visible', label: 'Visible' },
              { key: 'hidden', label: 'Hidden' },
            ].map((option) => (
              <button
                key={option.key}
                className={`filter-btn ${visibilityFilter === option.key ? 'active' : ''}`}
                onClick={() => setVisibilityFilter(option.key as typeof visibilityFilter)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="card top-rated-card">
        <div className="top-rated-header">
          <h2>Top Rated Items</h2>
          <span>{selectedCollege} this week</span>
        </div>

        <div className="top-rated-list">
          {topRatedItems.map((item, index) => (
            <div key={item.id || item._id} className="top-rated-item">
              <span className="top-rated-rank">{index + 1}</span>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {(item.averageRating || 0).toFixed(1)} stars from {item.totalReviews || 0} reviews
                </span>
              </div>
            </div>
          ))}

          {topRatedItems.length === 0 ? (
            <p className="empty-copy">Once students submit reviews, the top items will appear here.</p>
          ) : null}
        </div>
      </section>

      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}

      <div className="reviews-list">
        {loading ? (
          <div className="card empty-state">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="card empty-state">No reviews match the current filters.</div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="card review-card">
              <div className="review-card-top">
                <div>
                  <h3>{review.menuItem?.name || 'Menu item'}</h3>
                  <p>
                    {review.student?.name || 'Student'} • {review.student?.college || review.college || 'Campus'} •{' '}
                    {new Date(review.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="review-card-badges">
                  <span className={`badge ${review.isVisible ? 'badge-ready' : 'badge-failed'}`}>
                    {review.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                  <span className="rating-badge">{'★'.repeat(review.rating)}</span>
                </div>
              </div>

              {review.title ? <strong className="review-title">{review.title}</strong> : null}
              {review.body ? <p className="review-body">{review.body}</p> : null}

              {review.tags.length > 0 ? (
                <div className="review-tags">
                  {review.tags.map((tag) => (
                    <span key={tag} className="review-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="review-card-footer">
                <span>{review.helpful} helpful votes</span>
                <button
                  className={`btn ${review.isVisible ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => void handleToggleVisibility(review)}
                >
                  {review.isVisible ? 'Hide review' : 'Show review'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
