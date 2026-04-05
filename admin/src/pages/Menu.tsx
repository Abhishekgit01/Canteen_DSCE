import { useEffect, useState } from 'react';
import { menuApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import './Menu.css';

interface MenuItem {
  _id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  calories: number;
  category: string;
  tempOptions: string[];
  isAvailable: boolean;
  isFeatured?: boolean;
  college?: string;
}

const COLLEGE_OPTIONS = ['DSCE', 'NIE'] as const;

type CollegeOption = (typeof COLLEGE_OPTIONS)[number];

type MenuFormState = {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  calories: string;
  category: string;
  tempOptions: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  college: CollegeOption;
};

const resolveCollege = (value?: string | null): CollegeOption => (value === 'NIE' ? 'NIE' : 'DSCE');

const createEmptyForm = (college: CollegeOption): MenuFormState => ({
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  calories: '',
  category: 'meals',
  tempOptions: [],
  isAvailable: true,
  isFeatured: false,
  college,
});

export default function MenuPage() {
  const { user } = useAuth();
  const managerCollege = resolveCollege(user?.college);
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCollege, setSelectedCollege] = useState<CollegeOption>(managerCollege);
  const [formData, setFormData] = useState<MenuFormState>(() => createEmptyForm(managerCollege));

  useEffect(() => {
    setSelectedCollege(managerCollege);
    setFormData((current) => ({
      ...current,
      college: current.college || managerCollege,
    }));
  }, [managerCollege]);

  useEffect(() => {
    void fetchMenu();
  }, [selectedCollege, user?.college, user?.role]);

  const fetchMenu = async () => {
    try {
      const response = await menuApi.getMenu(isAdmin ? selectedCollege : user?.college);
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    }
  };

  const resetForm = (college = isAdmin ? selectedCollege : managerCollege) => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(createEmptyForm(college));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      price: Number(formData.price),
      calories: Number(formData.calories),
      college: isAdmin ? formData.college : managerCollege,
    };

    try {
      if (editingId) {
        await menuApi.updateItem(editingId, data);
      } else {
        await menuApi.createItem(data);
      }
      resetForm();
      void fetchMenu();
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await menuApi.updateItem(item._id, { isAvailable: !item.isAvailable });
      fetchMenu();
    } catch (error) {
      console.error('Failed to update availability:', error);
    }
  };

  const handleToggleFeatured = async (item: MenuItem) => {
    try {
      await menuApi.updateItem(item._id, { isFeatured: !item.isFeatured });
      fetchMenu();
    } catch (error) {
      console.error('Failed to update featured status:', error);
    }
  };

  return (
    <div className="menu-page">
      <div className="page-header">
        <div>
          <h1>Menu Management</h1>
          <p className="menu-subtitle">
            {isAdmin
              ? 'Switch colleges to manage each campus menu separately.'
              : `Managing ${managerCollege} menu items.`}
          </p>
        </div>
        <div className="menu-toolbar">
          {isAdmin ? (
            <select
              className="input menu-filter"
              value={selectedCollege}
              onChange={(e) => {
                const nextCollege = resolveCollege(e.target.value);
                setSelectedCollege(nextCollege);
                setFormData((current) => ({ ...current, college: nextCollege }));
              }}
            >
              {COLLEGE_OPTIONS.map((college) => (
                <option key={college} value={college}>
                  {college} menu
                </option>
              ))}
            </select>
          ) : null}
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingId(null);
              setFormData(createEmptyForm(isAdmin ? selectedCollege : managerCollege));
              setIsAdding(true);
            }}
          >
            Add Item
          </button>
        </div>
      </div>

      {(isAdding || editingId) && (
        <div className="modal">
          <div className="modal-content">
            <h2>{editingId ? 'Edit Item' : 'Add Item'}</h2>
            <form onSubmit={handleSubmit}>
              <input
                className="input"
                placeholder="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Image URL"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                required
              />
              <input
                className="input"
                type="number"
                placeholder="Price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
              <input
                className="input"
                type="number"
                placeholder="Calories"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                required
              />
              <select
                className="input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="meals">Meals</option>
                <option value="snacks">Snacks</option>
                <option value="beverages">Beverages</option>
                <option value="desserts">Desserts</option>
              </select>
              {isAdmin ? (
                <select
                  className="input"
                  value={formData.college}
                  onChange={(e) =>
                    setFormData({ ...formData, college: resolveCollege(e.target.value) })
                  }
                >
                  {COLLEGE_OPTIONS.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Save</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    resetForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>College</th>
            <th>Category</th>
            <th>Price</th>
            <th>Calories</th>
            <th>Available</th>
            <th>Featured</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td>
                <img src={item.imageUrl} alt={item.name} className="item-image" />
              </td>
              <td>{item.name}</td>
              <td>
                <span className="menu-college-badge">
                  {resolveCollege(item.college)}
                </span>
              </td>
              <td>{item.category}</td>
              <td>₹{item.price}</td>
              <td>{item.calories}</td>
              <td>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={item.isAvailable}
                    onChange={() => handleToggleAvailability(item)}
                  />
                  <span className="slider"></span>
                </label>
              </td>
              <td>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={!!item.isFeatured}
                    onChange={() => handleToggleFeatured(item)}
                  />
                  <span className="slider"></span>
                </label>
              </td>
              <td>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingId(item._id);
                    setFormData({
                      name: item.name,
                      description: item.description,
                      imageUrl: item.imageUrl,
                      price: String(item.price),
                      calories: String(item.calories),
                      category: item.category,
                      tempOptions: item.tempOptions,
                      isAvailable: item.isAvailable,
                      isFeatured: !!item.isFeatured,
                      college: resolveCollege(item.college),
                    });
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
