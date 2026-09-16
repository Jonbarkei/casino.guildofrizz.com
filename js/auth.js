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

  async function maybeShowAdminLink(uid) {
    try {
      const doc = await db.collection('admins').doc(uid).get();
      if (!doc.exists) return;
      document.querySelectorAll('.main-nav').forEach(nav => {
        if (nav.querySelector('.admin-nav-link')) return;
        const a = document.createElement('a');
        a.href = root + 'admin.html';
        a.className = 'admin-nav-link';
        a.textContent = '🛡️ Admin';
        nav.appendChild(a);
      });
    } catch (err) {
      // Not an admin (or rules denied the read) — nothing to show.
    }
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        await Casino.hydrateFromCloud(user.uid, db, user.email);
      } catch (err) {
        console.error('Failed to load cloud balance', err);
      }
      updateUserChips(user);
      maybeShowAdminLink(user.uid);
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
