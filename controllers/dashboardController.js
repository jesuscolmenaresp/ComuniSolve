exports.admin = (req, res) => {
  res.render('dashboards/admin', { usuario: req.session.usuario });
};

exports.lider = (req, res) => {
  res.render('dashboards/lider', { usuario: req.session.usuario });
};

exports.jefe = (req, res) => {
  res.render('dashboards/jefe', { usuario: req.session.usuario });
};
