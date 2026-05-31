import { Form, Field } from 'react-final-form';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api.php';

export default function LoginPage() {
  const navigate = useNavigate();

  async function onSubmit(values) {
    const response = await fetch(`${API_URL}?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem('libraryToken', result.token);
      localStorage.setItem('libraryUser', JSON.stringify(result.user));
      navigate('/books');
    } else {
      alert(result.error || 'Помилка входу');
    }
  }

  return (
    <div className="auth-page">
      <h1>Вхід</h1>

      <Form
        onSubmit={onSubmit}
        render={({ handleSubmit }) => (
          <form onSubmit={handleSubmit}>
            <Field name="username">
              {({ input }) => <input {...input} placeholder="Логін" />}
            </Field>

            <Field name="password">
              {({ input }) => (
                <input {...input} type="password" placeholder="Пароль" />
              )}
            </Field>

            <button type="submit">Увійти</button>
          </form>
        )}
      />
    </div>
  );
}
