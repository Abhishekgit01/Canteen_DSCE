import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import './Users.css';

interface User {
  _id: string;
  name: string;
  usn: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('all');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await usersApi.updateRole(id, newRole);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const filteredUsers = filter === 'all'
    ? users
    : users.filter(u => u.role === filter);

  return (
    <div className="users-page">
      <h1>Users</h1>

      <div className="filters">
        {['all', 'student', 'staff', 'manager', 'admin'].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>USN</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user) => (
            <tr key={user._id}>
              <td>{user.name}</td>
              <td>{user.usn}</td>
              <td>{user.email}</td>
              <td>
                <select
                  className="role-select"
                  value={user.role}
                  onChange={(e) => handleRoleChange(user._id, e.target.value)}
                  disabled={user._id === currentUser?.id}
                >
                  <option value="student">student</option>
                  <option value="staff">staff</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
