import { useEffect, useState } from 'react';
import { menuApi } from '../api';
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
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    price: '',
    calories: '',
    category: 'meals',
    tempOptions: [] as string[],
    isAvailable: true,
  });

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const response = await menuApi.getMenu();
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      price: Number(formData.price),
      calories: Number(formData.calories),
    };

    try {
      if (editingId) {
        await menuApi.updateItem(editingId, data);
      } else {
        await menuApi.createItem(data);
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        imageUrl: '',
        price: '',
        calories: '',
        category: 'meals',
        tempOptions: [],
        isAvailable: true,
      });
      fetchMenu();
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

  return (
    <div className="menu-page">
      <div className="page-header">
        <h1>Menu Management</h1>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
          Add Item
        </button>
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
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Save</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
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
            <th>Category</th>
            <th>Price</th>
            <th>Calories</th>
            <th>Available</th>
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
