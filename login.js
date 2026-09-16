(() => {
  const tabs = document.querySelectorAll('.login-tab');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmitBtn');

  let mode = 'signin';

  const ERROR_MESSAGES = {
    'auth/email-already-in-use': 'An account with that email already exists. Try signing in instead.',
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.'
  };

  function setMode(newMode) {
    mode = newMode;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
    passwordInput.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    errorEl.textContent = '';
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'signin' ? 'Signing In...' : 'Creating Account...';

    try {
      if (mode === 'signin') {
        await AuthActions.signIn(email, password);
      } else {
        await AuthActions.signUp(email, password);
      }
      // onAuthStateChanged in auth.js handles the redirect to the lobby.
    } catch (err) {
      errorEl.textContent = ERROR_MESSAGES[err.code] || err.message || 'Something went wrong. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
    }
  });
})();
