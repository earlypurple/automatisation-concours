import React, { useState, useEffect } from 'react';

function ProfilesSettings() {
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  const emptyProfile = {
    name: '',
    email: '',
    user_data: JSON.stringify({ name: "", phone: "", address: "" }, null, 2),
  };

  const [formData, setFormData] = useState(emptyProfile);

  const fetchProfiles = () => {
    setIsLoading(true);
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        setProfiles(data);
        setIsLoading(false);
      })
      .catch(error => {
        setError(error);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleShowForm = (profile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        email: profile.email,
        user_data: JSON.stringify(JSON.parse(profile.user_data), null, 2)
      });
    } else {
      setEditingProfile(null);
      setFormData(emptyProfile);
    }
    setShowForm(true);
  };

  const handleHideForm = () => {
    setShowForm(false);
    setEditingProfile(null);
    setFormData(emptyProfile);
  };

  const handleSave = () => {
    let userData;
    try {
      userData = JSON.parse(formData.user_data);
    } catch (e) {
      alert('Invalid JSON in user data.');
      return;
    }

    const profileData = {
      name: formData.name,
      email: formData.email,
      userData: userData
    };

    const url = editingProfile ? `/api/profiles/${editingProfile.id}` : '/api/profiles';
    const method = editingProfile ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to save profile');
      handleHideForm();
      fetchProfiles();
    })
    .catch(error => alert(`Error: ${error.message}`));
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this profile?')) {
      fetch(`/api/profiles/${id}`, { method: 'DELETE' })
        .then(res => {
          if (!res.ok) throw new Error('Failed to delete profile');
          fetchProfiles();
        })
        .catch(error => alert(`Error: ${error.message}`));
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Profiles</h2>
      <button onClick={() => handleShowForm(null)}>Add Profile</button>
      {showForm && (
        <div>
          <h3>{editingProfile ? 'Edit Profile' : 'Add Profile'}</h3>
          <form>
            <label>Name: <input type="text" name="name" value={formData.name} onChange={handleInputChange} /></label><br/>
            <label>Email: <input type="email" name="email" value={formData.email} onChange={handleInputChange} /></label><br/>
            <label>User Data (JSON): <textarea name="user_data" rows="5" value={formData.user_data} onChange={handleInputChange}></textarea></label><br/>
            <button type="button" onClick={handleSave}>Save</button>
            <button type="button" onClick={handleHideForm}>Cancel</button>
          </form>
        </div>
      )}
      <ul>
        {profiles.map(p => (
          <li key={p.id}>
            {p.name} {p.is_active ? '(Active)' : ''}
            <button onClick={() => handleShowForm(p)}>Edit</button>
            <button onClick={() => handleDelete(p.id)} disabled={profiles.length <= 1}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProfilesSettings;
