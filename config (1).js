// Настройки облачной базы (Firebase). Заполните по инструкции из README.md
window.GH_CFG = {
  dbUrl:  "https://YOUR-PROJECT-default-rtdb.firebaseio.com", // Realtime Database URL
  apiKey: "YOUR_WEB_API_KEY",                                  // Web API Key (Project settings)

  // Отправка кодов входа на почту (EmailJS). Пока YOUR_... — код показывается на экране (демо).
  emailjs: {
    serviceId:  "YOUR_SERVICE_ID",
    templateId: "YOUR_TEMPLATE_ID",
    publicKey:  "YOUR_PUBLIC_KEY"
  },

  // Платный Good Plus. Пока payUrl = YOUR_..., покупка отключена.
  plus: {
    price:  "199 ₽ / месяц",
    days:   30,                          // на сколько дней выдаётся Plus (должно совпадать с PLUS_DAYS в Worker)
    auto:   false,                       // true, когда подключён Worker с вебхуком Stripe
    payUrl: "YOUR_PAYMENT_LINK"          // ссылка на оплату (Stripe Payment Link, Boosty и т.п.)
  }
};
