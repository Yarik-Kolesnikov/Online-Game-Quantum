/* firebase-config.js — підключення спільного рейтингу (Cloud Firestore, проєкт business-lab, безкоштовний план Spark).
   Ці ключі не секретні: у вебзастосунках вони завжди видні в браузері.
   Дані захищають правила з firestore.rules (вже опубліковані у Firebase Console):
   читати й додавати результати може кожен, змінювати й видаляти з сайту — ніхто.
   Якщо поставити тут null, рейтинг зберігатиметься лише в цьому браузері (localStorage). */
BL.firebaseConfig = {
  apiKey: "AIzaSyDRTwu2zkoVuAxLldUA2Cmzxv-g3-CfChA",
  authDomain: "business-lab-c15c7.firebaseapp.com",
  projectId: "business-lab-c15c7",
  storageBucket: "business-lab-c15c7.firebasestorage.app",
  messagingSenderId: "864744994356",
  appId: "1:864744994356:web:9ea7cead9f56f9c006bc61"
};
