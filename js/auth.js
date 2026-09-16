(() => {
  const auth = firebase.auth();
  const db = firebase.firestore();

  const root = document.body.dataset.root ?? '';
  const isLoginPage = document.body.dataset.page === 'login';

  function removeGate() {
    const gate = document.getElementById('authGate');
    if (gate) gate.remove();
  }

  function goTo(path) {
    window.location.href = root + path;
  }

  function updateUserChips(user) {
    document.querySelectorAll('.user-email').forEach(el => { el.textContent = user.email; });
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const displayName = (user.email || 'Player').split('@')[0];
        await Casino.hydrateFromCloud(user.uid, db, displayName);
      } catch (err) {
        console.error('Failed to load cloud balance', err);
      }
      updateUserChips(user);
      if (isLoginPage) {
        goTo('index.html');
        return;
      }
      removeGate();
    } else {
      Casino.clearCloudContext();
      if (!isLoginPage) {
        goTo('login.html');
        return;
      }
      removeGate();
    }
  });

  window.AuthActions = {
    signUp(email, password) {
      return auth.createUserWithEmailAndPassword(email, password);
    },
    signIn(email, password) {
      return auth.signInWithEmailAndPassword(email, password);
    },
    logOut() {
      return auth.signOut();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.logout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AuthActions.logOut();
      });
    });
  });
})();
