const bcrypt = require('bcryptjs');

const passwordPlano = '123456';

bcrypt.hash(passwordPlano, 10).then(hash => {
  console.log('🔐 Hash generado para 123456:');
  console.log(hash);
});
