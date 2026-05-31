import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loginSuccess, logout } from './store/authSlice';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api.php';

const tables = {
  books: {
    title: 'Книжки',
    pk: 'BookID',
    fields: ['Title', 'Author', 'Genre', 'Year', 'ISBN', 'Quantity'],
    guest: ['Title', 'Author', 'Genre', 'Year', 'ISBN', 'Quantity'],
    client: ['BookID', 'Title', 'Author', 'Genre', 'Year', 'ISBN', 'Quantity'],
    admin: ['BookID', 'Title', 'Author', 'Genre', 'Year', 'ISBN', 'Quantity']
  },
  clients: {
    title: 'Клієнти',
    pk: 'ClientID',
    fields: ['FullName', 'Phone', 'Email', 'Address'],
    guest: [],
    client: [],
    admin: ['ClientID', 'FullName', 'Phone', 'Email', 'Address']
  },
  accounting: {
    title: 'Облік',
    pk: 'AccountingID',
    fields: ['ClientID', 'BookID', 'BorrowDate', 'ReturnDate', 'Status'],
    guest: [],
    client: ['BookTitle', 'BorrowDate', 'ReturnDate', 'Status'],
    admin: ['AccountingID', 'ClientID', 'BookID', 'ClientName', 'BookTitle', 'BorrowDate', 'ReturnDate', 'Status']
  },
  users: {
    title: 'Користувачі',
    pk: 'id',
    fields: ['username', 'password', 'role', 'ClientID'],
    guest: [],
    client: [],
    admin: ['id', 'username', 'role', 'ClientID']
  }
};

function inputType(field) {
  if (field.includes('Date')) return 'date';
  if (field.includes('ID') || field === 'Year' || field === 'Quantity') return 'number';
  return 'text';
}

export default function LibraryPage({ initialResource = 'books' }) {
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [showAuth, setShowAuth] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [authMode, setAuthMode] = React.useState('login');
  const [authForm, setAuthForm] = React.useState({ username: '', password: '', fullName: '' });
  const [authErrors, setAuthErrors] = React.useState({});

  const role = user ? user.role : 'guest';

  const [resource, setResource] = React.useState(initialResource);
  const [items, setItems] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState('');
  const [direction, setDirection] = React.useState('ASC');

  const [addForm, setAddForm] = React.useState({});
  const [editForm, setEditForm] = React.useState({});
  const [editingId, setEditingId] = React.useState(null);

  const [message, setMessage] = React.useState('');
  const [messageType, setMessageType] = React.useState('error');

  const [fieldErrors, setFieldErrors] = React.useState({ add: {}, edit: {} });

  const [clientsList, setClientsList] = React.useState([]);
  const [booksList, setBooksList] = React.useState([]);

  const availableTables = Object.keys(tables).filter(key => tables[key][role].length > 0);
  const config = tables[resource] || tables.books;
  const fields = config[role] || [];
  const formFields = config.fields;

  function canEdit() { return role === 'admin'; }
  function canAdd() { return role === 'admin'; }

  function authHeaders() {
    const token = localStorage.getItem('libraryToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  function showMessage(text, type = 'error') {
    setMessage(text);
    setMessageType(type);
  }

  function apiUrl(params) {
    const token = localStorage.getItem('libraryToken');
    if (token) params.append('token', token);
    return `${API_URL}?${params.toString()}`;
  }

  function clearFieldError(formType, field) {
    setFieldErrors(prev => ({ ...prev, [formType]: { ...prev[formType], [field]: '' } }));
  }

  function setFieldError(formType, field, text) {
    setFieldErrors(prev => ({ ...prev, [formType]: { ...prev[formType], [field]: text } }));
  }

  function validateForm(form) {
    const errors = {};
    if (resource === 'clients') {
      if (!form.FullName?.trim()) errors.FullName = 'ПІБ обов\'язкове';
      if (!form.Phone?.trim()) errors.Phone = 'Телефон обов\'язковий';
    }
    if (resource === 'books') {
      if (!form.Title?.trim()) errors.Title = 'Назва обов\'язкова';
      if (!form.Author?.trim()) errors.Author = 'Автор обов\'язковий';
      if (!form.Quantity) errors.Quantity = 'Кількість обов\'язкова';
    }
    if (resource === 'accounting') {
      if (!form.ClientID) errors.ClientID = 'Оберіть клієнта';
      if (!form.BookID) errors.BookID = 'Оберіть книжку';
      if (!form.BorrowDate) errors.BorrowDate = 'Вкажіть дату видачі';
      if (!form.Status?.trim()) errors.Status = 'Вкажіть статус';
    }
    if (resource === 'users') {
      if (!form.username?.trim()) errors.username = 'Логін обов\'язковий';
      if (!form.role) errors.role = 'Роль обов\'язкова';
    }
    return errors;
  }

  function apiErrorToField(error) {
    if (!error) return null;
    const text = String(error).toLowerCase();
    if (text.includes('client')) return 'ClientID';
    if (text.includes('book')) return 'BookID';
    if (text.includes('date')) return 'BorrowDate';
    if (text.includes('password')) return 'password';
    if (text.includes('username')) return 'username';
    return null;
  }

  async function loadData() {
    setItems([]);
    const params = new URLSearchParams();
    params.append('resource', resource);
    if (role === 'client' && resource === 'accounting' && !user?.clientId) {
      showMessage('Акаунт не прив\'язаний до клієнта');
      return;
    }
    if (search.trim()) params.append('search', search.trim());
    if (sort) { params.append('sort', sort); params.append('direction', direction); }
    try {
      const response = await fetch(apiUrl(params), { headers: authHeaders() });
      const data = await response.json();
      if (Array.isArray(data)) { setItems(data); setMessage(''); }
      else { setItems([]); showMessage(data.error || 'Помилка завантаження'); }
    } catch { setItems([]); showMessage('Немає зв\'язку з API'); }
  }

  async function loadSupportData() {
    try {
      const makeParams = r => { const p = new URLSearchParams(); p.append('resource', r); return p; };
      const [cRes, bRes] = await Promise.all([
        fetch(apiUrl(makeParams('clients')), { headers: authHeaders() }),
        fetch(apiUrl(makeParams('books')), { headers: authHeaders() })
      ]);
      const c = await cRes.json();
      const b = await bRes.json();
      setClientsList(Array.isArray(c) ? c : []);
      setBooksList(Array.isArray(b) ? b : []);
    } catch { setClientsList([]); setBooksList([]); }
  }

  React.useEffect(() => {
    if (resource === 'accounting' && role === 'admin') loadSupportData();
  }, [resource, role]);

  React.useEffect(() => {
    setItems([]); setSearch(''); setSort(''); setDirection('ASC');
    setAddForm({}); setEditForm({}); setEditingId(null); setShowAddForm(false);
    setMessage(''); setFieldErrors({ add: {}, edit: {} });
    navigate(`/${resource}`);
  }, [resource, navigate]);

  React.useEffect(() => { loadData(); }, [resource, role, user?.clientId, search, sort, direction]);

  async function handleLogin() {
    setAuthErrors({});
    const errors = {};
    if (!authForm.username.trim()) errors.username = 'Введіть логін';
    if (!authForm.password.trim()) errors.password = 'Введіть пароль';
    if (Object.keys(errors).length > 0) { setAuthErrors(errors); return; }
    try {
      const response = await fetch(`${API_URL}?action=login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const result = await response.json();
      if (result.success) {
        localStorage.setItem('libraryToken', result.token);
        dispatch(loginSuccess(result.user));
        setShowAuth(false);
        setAuthForm({ username: '', password: '', fullName: '' });
        setAuthErrors({});
      } else { setAuthErrors({ username: result.error || 'Помилка входу' }); }
    } catch { setAuthErrors({ username: 'Немає зв\'язку з API' }); }
  }

  async function handleRegister() {
    setAuthErrors({});
    const errors = {};
    if (!authForm.username.trim()) errors.username = 'Введіть логін';
    if (!authForm.password.trim()) errors.password = 'Введіть пароль';
    if (!authForm.fullName.trim()) errors.fullName = 'Введіть ПІБ';
    if (Object.keys(errors).length > 0) { setAuthErrors(errors); return; }
    try {
      const response = await fetch(`${API_URL}?action=register`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(authForm)
      });
      const result = await response.json();
      if (result.success) {
        setAuthMode('login');
        setAuthForm({ username: '', password: '', fullName: '' });
        setAuthErrors({ username: 'Реєстрація успішна. Тепер увійдіть.' });
      } else { setAuthErrors({ fullName: result.error || 'Помилка реєстрації' }); }
    } catch { setAuthErrors({ username: 'Немає зв\'язку з API' }); }
  }

  function handleLogout() {
    localStorage.removeItem('libraryToken');
    dispatch(logout());
    setShowAuth(false);
    setResource('books');
    navigate('/books');
  }

  async function addItem(e) {
    e.preventDefault();
    setMessage(''); setFieldErrors(prev => ({ ...prev, add: {} }));
    const errors = validateForm(addForm);
    if (Object.keys(errors).length > 0) { setFieldErrors(prev => ({ ...prev, add: errors })); return; }
    try {
      const p = new URLSearchParams(); p.append('resource', resource);
      const response = await fetch(apiUrl(p), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(addForm)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('Запис успішно додано', 'success');
        setAddForm({}); setFieldErrors(prev => ({ ...prev, add: {} })); setShowAddForm(false); loadData();
      } else {
        const field = apiErrorToField(result.error);
        if (field) setFieldError('add', field, result.error);
        else showMessage(result.error || 'Помилка додавання');
      }
    } catch { showMessage('Немає зв\'язку з API'); }
  }

  function startEdit(item) {
    const data = {};
    config.fields.forEach(field => { data[field] = item[field] ?? ''; });
    setEditForm(data); setEditingId(item[config.pk]);
    setFieldErrors(prev => ({ ...prev, edit: {} }));
  }

  async function saveEdit(e) {
    e.preventDefault();
    setMessage(''); setFieldErrors(prev => ({ ...prev, edit: {} }));
    const errors = validateForm(editForm);
    if (Object.keys(errors).length > 0) { setFieldErrors(prev => ({ ...prev, edit: errors })); return; }
    try {
      const p = new URLSearchParams(); p.append('resource', resource); p.append('id', editingId);
      const response = await fetch(apiUrl(p), {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(editForm)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('Запис успішно оновлено', 'success');
        setEditForm({}); setEditingId(null);
        setFieldErrors(prev => ({ ...prev, edit: {} })); loadData();
      } else {
        const field = apiErrorToField(result.error);
        if (field) setFieldError('edit', field, result.error);
        else showMessage(result.error || 'Помилка редагування');
      }
    } catch { showMessage('Немає зв\'язку з API'); }
  }

  async function removeItem(id) {
    if (!window.confirm('Видалити запис?')) return;
    try {
      const p = new URLSearchParams(); p.append('resource', resource); p.append('id', id);
      const response = await fetch(apiUrl(p), {
        method: 'DELETE', headers: authHeaders()
      });
      const result = await response.json();
      if (result.success) { showMessage('Запис успішно видалено', 'success'); loadData(); }
      else showMessage(result.error || 'Помилка видалення');
    } catch { showMessage('Немає зв\'язку з API'); }
  }

  async function borrowBook(bookId) {
    if (!window.confirm('Ви впевнені, що хочете взяти цю книгу?')) return;
    try {
      const p = new URLSearchParams(); p.append('action', 'borrow');
      const res = await fetch(apiUrl(p), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ bookId })
      });
      const data = await res.json();
      if (data.success) { showMessage('Книгу успішно взято! Ви можете знайти її в розділі "Мої книги".', 'success'); loadData(); }
      else showMessage(data.error || 'Помилка');
    } catch { showMessage("Немає зв'язку з API"); }
  }

  async function returnBook(accountingId) {
    if (!window.confirm('Повернути книгу в бібліотеку?')) return;
    try {
      const p = new URLSearchParams(); p.append('action', 'return');
      const res = await fetch(apiUrl(p), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ accountingId })
      });
      const data = await res.json();
      if (data.success) { showMessage('Книгу успішно повернуто!', 'success'); loadData(); }
      else showMessage(data.error || 'Помилка');
    } catch { showMessage("Немає зв'язку з API"); }
  }

  function FieldError({ formType, field }) {
    const error = fieldErrors?.[formType]?.[field];
    if (!error) return null;
    return <span className="field-error">{error}</span>;
  }

  function FormFields({ form, setForm, formType }) {
    return formFields.map(field => {
      if (resource === 'accounting' && field === 'ClientID') {
        return (
          <label className="form-field" key={field}>
            <span>Клієнт</span>
            <FieldError formType={formType} field={field} />
            <select value={form.ClientID ?? ''} onChange={e => { setForm(prev => ({ ...prev, ClientID: e.target.value })); clearFieldError(formType, 'ClientID'); }}>
              <option value="">Оберіть клієнта</option>
              {clientsList.map(c => <option key={c.ClientID} value={c.ClientID}>{c.FullName}</option>)}
            </select>
          </label>
        );
      }
      if (resource === 'accounting' && field === 'BookID') {
        return (
          <label className="form-field" key={field}>
            <span>Книжка</span>
            <FieldError formType={formType} field={field} />
            <select value={form.BookID ?? ''} onChange={e => { setForm(prev => ({ ...prev, BookID: e.target.value })); clearFieldError(formType, 'BookID'); }}>
              <option value="">Оберіть книжку</option>
              {booksList.map(b => <option key={b.BookID} value={b.BookID}>{b.Title} — {b.Author}</option>)}
            </select>
          </label>
        );
      }
      if (field === 'Status' && resource === 'accounting') {
        return (
          <label className="form-field" key={field}>
            <span>Статус</span>
            <FieldError formType={formType} field={field} />
            <select value={form[field] ?? ''} onChange={e => { setForm(prev => ({ ...prev, [field]: e.target.value })); clearFieldError(formType, field); }}>
              <option value="">Оберіть статус</option>
              <option value="видано">Видано</option>
              <option value="повернено">Повернено</option>
              <option value="протерміновано">Протерміновано</option>
              <option value="втрачено">Втрачено</option>
            </select>
          </label>
        );
      }
      if (field === 'role') {
        return (
          <label className="form-field" key={field}>
            <span>Роль</span>
            <FieldError formType={formType} field={field} />
            <select value={form[field] ?? 'client'} onChange={e => { setForm(prev => ({ ...prev, [field]: e.target.value })); clearFieldError(formType, field); }}>
              <option value="client">Клієнт</option>
              <option value="admin">Адміністратор</option>
            </select>
          </label>
        );
      }
      return (
        <label className="form-field" key={field}>
          <span>{field}</span>
          <FieldError formType={formType} field={field} />
          <input type={inputType(field)} value={form[field] ?? ''} onChange={e => { setForm(prev => ({ ...prev, [field]: e.target.value })); clearFieldError(formType, field); }} />
        </label>
      );
    });
  }

  return (
    <div className="app">
      {/* ─── Flat Navbar ─── */}
      <nav className="navbar">
        <div className="nav-brand">📚 Бібліотека</div>

        <div className="nav-tabs">
          {availableTables.map(key => {
            const tabTitle = role === 'client' && key === 'accounting' ? 'Мої книги' : tables[key].title;
            return (
              <button
                key={key}
                className={`nav-tab ${resource === key ? 'active' : ''}`}
                onClick={() => { setResource(key); navigate(`/${key}`); }}
              >
                {tabTitle}
              </button>
            );
          })}
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user">{user.clientName || user.username}</span>
              <span className="role-pill">{role === 'admin' ? 'Адмін' : 'Клієнт'}</span>
              <button className="btn-outline" onClick={handleLogout}>Вийти</button>
            </>
          ) : (
            <>
              <button className="btn-link" onClick={() => setShowAuth(true)}>Увійти</button>
              <button className="btn-primary" onClick={() => { setAuthMode('register'); setShowAuth(true); }}>Реєстрація</button>
            </>
          )}
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="hero">
        <div className="hero-left">
          <span className="hero-badge">
            {role === 'admin' ? '✦ Система управління бібліотекою' : '✦ Особистий кабінет читача'}
          </span>
          <h1>
            {role === 'admin' ? 'Керуйте бібліотекою легко та зручно.' : 'Відкрийте для себе світ нових книг.'}
          </h1>
          <p className="hero-desc">
            {role === 'admin' 
              ? 'Додавайте книжки, реєструйте клієнтів, відстежуйте видачу та повернення — все в одному місці.' 
              : 'Переглядайте доступну літературу, беріть книги для читання та відстежуйте історію свого абонементу.'}
          </p>
        </div>
      </section>

      {/* ─── Auth Modal ─── */}
      {showAuth && (
        <div className="auth-overlay">
          <div className="auth-box">
            <p className="auth-label">Акаунт бібліотеки</p>
            <h2>{authMode === 'login' ? 'З поверненням' : 'Створити акаунт'}</h2>
            <p className="auth-subtitle">
              {authMode === 'login'
                ? 'Увійдіть для доступу до вашого кабінету'
                : 'Зареєструйтесь як клієнт'}
            </p>

            <input placeholder="Логін" value={authForm.username}
              onChange={e => { setAuthForm({ ...authForm, username: e.target.value }); setAuthErrors({ ...authErrors, username: '' }); }} />
            {authErrors.username && <span className="field-error">{authErrors.username}</span>}

            <input type="password" placeholder="Пароль" value={authForm.password}
              onChange={e => { setAuthForm({ ...authForm, password: e.target.value }); setAuthErrors({ ...authErrors, password: '' }); }} />
            {authErrors.password && <span className="field-error">{authErrors.password}</span>}

            {authMode === 'register' && (
              <>
                <input placeholder="ПІБ" value={authForm.fullName || ''}
                  onChange={e => { setAuthForm({ ...authForm, fullName: e.target.value }); setAuthErrors({ ...authErrors, fullName: '' }); }} />
                {authErrors.fullName && <span className="field-error">{authErrors.fullName}</span>}
              </>
            )}

            <div className="auth-actions">
              {authMode === 'login' ? (
                <>
                  <button className="btn-primary" onClick={handleLogin}>Увійти</button>
                  <button className="btn-outline" onClick={() => setAuthMode('register')}>Реєстрація</button>
                </>
              ) : (
                <>
                  <button className="btn-primary" onClick={handleRegister}>Створити</button>
                  <button className="btn-outline" onClick={() => setAuthMode('login')}>Назад</button>
                </>
              )}
              <button className="btn-danger" onClick={() => setShowAuth(false)}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content Card ─── */}
      <main className="content-card">
        <div className="content-header">
          <h2>{role === 'client' && resource === 'accounting' ? 'Мої книги' : config.title}</h2>
          <div className="toolbar">
            <input className="search-input" placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)} />
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="">Сортування</option>
              {fields.map(f => <option key={`s-${f}`} value={f}>{f}</option>)}
            </select>
            <select value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="ASC">↑ Зрост.</option>
              <option value="DESC">↓ Спад.</option>
            </select>
            {canAdd() && (
              <button className="btn-primary" onClick={() => setShowAddForm(true)}>+ Додати</button>
            )}
          </div>
        </div>

        {message && (
          <p className={`message ${messageType}`}>{message}</p>
        )}

        {/* ─── Add Modal ─── */}
        {showAddForm && (
          <div className="auth-overlay">
            <div className="auth-box">
              <h2>Додати запис</h2>
              <form onSubmit={addItem} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <FormFields form={addForm} setForm={setAddForm} formType="add" />
                <div className="auth-actions">
                  <button type="submit" className="btn-primary">Додати</button>
                  <button type="button" className="btn-outline" onClick={() => setShowAddForm(false)}>Скасувати</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Edit Modal ─── */}
        {editingId && (
          <div className="auth-overlay">
            <div className="auth-box">
              <h2>Редагувати запис</h2>
              <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <FormFields form={editForm} setForm={setEditForm} formType="edit" />
                <div className="auth-actions">
                  <button type="submit" className="btn-primary">Зберегти</button>
                  <button type="button" className="btn-outline" onClick={() => { setEditingId(null); setEditForm({}); setFieldErrors(prev => ({ ...prev, edit: {} })); }}>Скасувати</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {fields.map(f => <th key={f}>{f}</th>)}
                {(canEdit() || (role === 'client' && (resource === 'books' || resource === 'accounting'))) && <th>Дії</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={fields.length + 1}>Даних не знайдено</td></tr>
              ) : (
                items.map((item, i) => (
                  <tr key={`${resource}-${item[config.pk] ?? i}-${i}`}>
                    {fields.map((f, fi) => {
                      if (f === 'Status') {
                        return (
                          <td key={`${resource}-${item[config.pk] ?? i}-${f}-${fi}`}>
                            <span className={`role-pill`} style={{background: item[f] === 'повернено' ? '#f0fdf4' : item[f] === 'видано' ? '#fefce8' : '#fef2f2', color: item[f] === 'повернено' ? '#16a34a' : item[f] === 'видано' ? '#ca8a04' : '#dc2626', border: 'none'}}>{item[f]}</span>
                          </td>
                        );
                      }
                      return <td key={`${resource}-${item[config.pk] ?? i}-${f}-${fi}`}>{item[f]}</td>
                    })}
                    
                    {/* Admin Actions */}
                    {canEdit() && (
                      <td className="actions-cell">
                        <button className="btn-sm" onClick={() => startEdit(item)}>✏️</button>
                        <button className="btn-sm btn-danger-sm" onClick={() => removeItem(item[config.pk])}>🗑️</button>
                      </td>
                    )}

                    {/* Client Actions */}
                    {role === 'client' && resource === 'books' && (
                      <td className="actions-cell">
                        {item.Quantity > 0 ? (
                          <button className="btn-sm" style={{borderColor: '#16a34a', color: '#16a34a'}} onClick={() => borrowBook(item.BookID)}>Взяти книгу</button>
                        ) : (
                          <span style={{fontSize: '13px', color: 'gray'}}>Немає в наявності</span>
                        )}
                      </td>
                    )}
                    {role === 'client' && resource === 'accounting' && (
                      <td className="actions-cell">
                        {(item.Status === 'видано' || item.Status === 'протерміновано') && (
                          <button className="btn-sm" onClick={() => returnBook(item.AccountingID)}>Здати</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
