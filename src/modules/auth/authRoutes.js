const express = require("express");
const router = express.Router();
const auth = require("./authController");
const { verifyToken } = require("../../middlewares/auth");

router.post("/login", auth.login);
router.post("/seleccionar-rol", auth.seleccionarRol);
router.get("/me", verifyToken, auth.me);
router.post("/logout", auth.logout);
router.post("/solicitar-recuperacion", auth.solicitarRecuperacion);
router.post("/verificar-recovery-token", auth.verificarRecoveryToken);
router.post("/cancelar-recuperacion", auth.cancelarRecuperacion);
router.post("/restablecer-contrasena", auth.restablecerContrasena);

module.exports = router;
