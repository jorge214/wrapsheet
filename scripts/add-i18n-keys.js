const fs = require("fs");
const path = require("path");

const keys = {
  auth_login_title: { pt: "Entrar", "pt-BR": "Entrar", en: "Sign In", es: "Iniciar sesión", fr: "Se connecter", de: "Anmelden", it: "Accedi" },
  auth_register_title: { pt: "Criar conta", "pt-BR": "Criar conta", en: "Create Account", es: "Crear cuenta", fr: "Créer un compte", de: "Konto erstellen", it: "Crea account" },
  auth_forgot_title: { pt: "Recuperar password", "pt-BR": "Recuperar senha", en: "Reset Password", es: "Recuperar contraseña", fr: "Réinitialiser le mot de passe", de: "Passwort zurücksetzen", it: "Recupera password" },
  auth_forgot_link: { pt: "Esqueceste a password?", "pt-BR": "Esqueceu sua senha?", en: "Forgot your password?", es: "¿Olvidaste tu contraseña?", fr: "Mot de passe oublié ?", de: "Passwort vergessen?", it: "Hai dimenticato la password?" },
  auth_no_account: { pt: "Ainda não tens conta?", "pt-BR": "Ainda não tem conta?", en: "Don't have an account?", es: "¿No tienes cuenta?", fr: "Pas encore de compte ?", de: "Noch kein Konto?", it: "Non hai un account?" },
  auth_register_link: { pt: "Registar", "pt-BR": "Cadastrar", en: "Register", es: "Registrarse", fr: "S'inscrire", de: "Registrieren", it: "Registrati" },
  auth_send_email: { pt: "Enviar email", "pt-BR": "Enviar email", en: "Send Email", es: "Enviar email", fr: "Envoyer l'email", de: "E-Mail senden", it: "Invia email" },
  auth_email_sent: { pt: "Email enviado! Verifica a tua caixa de entrada para redefinir a password.", "pt-BR": "Email enviado! Verifique sua caixa de entrada para redefinir a senha.", en: "Email sent! Check your inbox to reset your password.", es: "¡Email enviado! Revisa tu bandeja de entrada para restablecer la contraseña.", fr: "Email envoyé ! Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.", de: "E-Mail gesendet! Prüfen Sie Ihren Posteingang, um das Passwort zurückzusetzen.", it: "Email inviata! Controlla la tua casella di posta per reimpostare la password." },
  auth_password: { pt: "Password", "pt-BR": "Senha", en: "Password", es: "Contraseña", fr: "Mot de passe", de: "Passwort", it: "Password" },
  auth_confirm_password: { pt: "Confirmar password", "pt-BR": "Confirmar senha", en: "Confirm Password", es: "Confirmar contraseña", fr: "Confirmer le mot de passe", de: "Passwort bestätigen", it: "Conferma password" },
  auth_new_password: { pt: "Nova password", "pt-BR": "Nova senha", en: "New Password", es: "Nueva contraseña", fr: "Nouveau mot de passe", de: "Neues Passwort", it: "Nuova password" },
  auth_confirm_new_password: { pt: "Confirmar nova password", "pt-BR": "Confirmar nova senha", en: "Confirm New Password", es: "Confirmar nueva contraseña", fr: "Confirmer le nouveau mot de passe", de: "Neues Passwort bestätigen", it: "Conferma nuova password" },
  auth_password_placeholder: { pt: "Mínimo 6 caracteres", "pt-BR": "Mínimo 6 caracteres", en: "Minimum 6 characters", es: "Mínimo 6 caracteres", fr: "Minimum 6 caractères", de: "Mindestens 6 Zeichen", it: "Minimo 6 caratteri" },
  auth_password_confirm_placeholder: { pt: "Repetir password", "pt-BR": "Repetir senha", en: "Repeat password", es: "Repetir contraseña", fr: "Répéter le mot de passe", de: "Passwort wiederholen", it: "Ripeti password" },
  auth_password_mismatch: { pt: "As passwords não coincidem.", "pt-BR": "As senhas não coincidem.", en: "Passwords do not match.", es: "Las contraseñas no coinciden.", fr: "Les mots de passe ne correspondent pas.", de: "Die Passwörter stimmen nicht überein.", it: "Le password non coincidono." },
  auth_password_too_short: { pt: "A password deve ter pelo menos 6 caracteres.", "pt-BR": "A senha deve ter pelo menos 6 caracteres.", en: "Password must be at least 6 characters.", es: "La contraseña debe tener al menos 6 caracteres.", fr: "Le mot de passe doit comporter au moins 6 caractères.", de: "Das Passwort muss mindestens 6 Zeichen lang sein.", it: "La password deve essere di almeno 6 caratteri." },
  auth_password_changed: { pt: "Password alterada com sucesso.", "pt-BR": "Senha alterada com sucesso.", en: "Password changed successfully.", es: "Contraseña cambiada correctamente.", fr: "Mot de passe modifié avec succès.", de: "Passwort erfolgreich geändert.", it: "Password modificata con successo." },
  auth_save_password: { pt: "Guardar nova password", "pt-BR": "Salvar nova senha", en: "Save New Password", es: "Guardar nueva contraseña", fr: "Enregistrer le nouveau mot de passe", de: "Neues Passwort speichern", it: "Salva nuova password" },
  auth_sign_out: { pt: "Terminar sessão", "pt-BR": "Sair da conta", en: "Sign Out", es: "Cerrar sesión", fr: "Se déconnecter", de: "Abmelden", it: "Disconnetti" },
  auth_signing_out: { pt: "A sair…", "pt-BR": "Saindo…", en: "Signing out…", es: "Cerrando sesión…", fr: "Déconnexion…", de: "Abmelden…", it: "Disconnessione…" },
  auth_delete_account: { pt: "Apagar conta", "pt-BR": "Excluir conta", en: "Delete Account", es: "Eliminar cuenta", fr: "Supprimer le compte", de: "Konto löschen", it: "Elimina account" },
  auth_delete_account_confirm: { pt: "Esta ação é permanente. Todos os teus dados serão eliminados. Continuar?", "pt-BR": "Esta ação é permanente. Todos os seus dados serão excluídos. Continuar?", en: "This action is permanent. All your data will be deleted. Continue?", es: "Esta acción es permanente. Todos tus datos serán eliminados. ¿Continuar?", fr: "Cette action est permanente. Toutes vos données seront supprimées. Continuer ?", de: "Diese Aktion ist dauerhaft. Alle Ihre Daten werden gelöscht. Fortfahren?", it: "Questa azione è permanente. Tutti i tuoi dati verranno eliminati. Continuare?" },
  auth_delete_account_error: { pt: "Não foi possível apagar a conta. Contacta o suporte.", "pt-BR": "Não foi possível excluir a conta. Entre em contato com o suporte.", en: "Could not delete account. Please contact support.", es: "No se pudo eliminar la cuenta. Contacta con el soporte.", fr: "Impossible de supprimer le compte. Contactez le support.", de: "Konto konnte nicht gelöscht werden. Bitte kontaktieren Sie den Support.", it: "Impossibile eliminare l'account. Contatta il supporto." },
  account_title: { pt: "Conta", "pt-BR": "Conta", en: "Account", es: "Cuenta", fr: "Compte", de: "Konto", it: "Account" },
  account_session: { pt: "Conta e sessão", "pt-BR": "Conta e sessão", en: "Account & Session", es: "Cuenta y sesión", fr: "Compte et session", de: "Konto & Sitzung", it: "Account e sessione" },
  account_section_email: { pt: "EMAIL", "pt-BR": "EMAIL", en: "EMAIL", es: "EMAIL", fr: "EMAIL", de: "E-MAIL", it: "EMAIL" },
  account_section_subscription: { pt: "SUBSCRIÇÃO", "pt-BR": "ASSINATURA", en: "SUBSCRIPTION", es: "SUSCRIPCIÓN", fr: "ABONNEMENT", de: "ABONNEMENT", it: "ABBONAMENTO" },
  account_section_password: { pt: "ALTERAR PASSWORD", "pt-BR": "ALTERAR SENHA", en: "CHANGE PASSWORD", es: "CAMBIAR CONTRASEÑA", fr: "CHANGER LE MOT DE PASSE", de: "PASSWORT ÄNDERN", it: "CAMBIA PASSWORD" },
  account_section_danger: { pt: "ZONA DE PERIGO", "pt-BR": "ZONA DE PERIGO", en: "DANGER ZONE", es: "ZONA DE PELIGRO", fr: "ZONE DANGEREUSE", de: "GEFAHRENBEREICH", it: "ZONA DI PERICOLO" },
  account_free_plan: { pt: "Plano gratuito", "pt-BR": "Plano gratuito", en: "Free Plan", es: "Plan gratuito", fr: "Plan gratuit", de: "Kostenloser Plan", it: "Piano gratuito" },
  account_pro_soon: { pt: "WrapSheet Pro em breve", "pt-BR": "WrapSheet Pro em breve", en: "WrapSheet Pro coming soon", es: "WrapSheet Pro próximamente", fr: "WrapSheet Pro bientôt disponible", de: "WrapSheet Pro demnächst", it: "WrapSheet Pro in arrivo" },
  account_see_plans: { pt: "Ver planos", "pt-BR": "Ver planos", en: "See Plans", es: "Ver planes", fr: "Voir les plans", de: "Pläne ansehen", it: "Vedi piani" },
};

const langs = ["pt", "pt-BR", "en", "es", "fr", "de", "it"];
langs.forEach((lang) => {
  const filePath = path.join("src", "i18n", lang + ".json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  Object.entries(keys).forEach(([k, v]) => { data[k] = v[lang]; });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("Updated", lang);
});
