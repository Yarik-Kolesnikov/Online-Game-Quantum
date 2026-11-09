/* Стара адреса (GitHub Pages) веде на нову: business-lab-zp.vercel.app.
   Окремим файлом, а не вбудованим <script>, щоб політика безпеки (CSP) забороняла будь-які вбудовані скрипти. */
if (/github\.io$/.test(location.hostname))
  location.replace("https://business-lab-zp.vercel.app/" + location.search + location.hash);
