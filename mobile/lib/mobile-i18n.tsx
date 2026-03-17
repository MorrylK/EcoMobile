import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '../utils/storage';

type Language = 'fr' | 'en';

interface Translations {
  [key: string]: {
    fr: string;
    en: string;
  };
}

const translations: Translations = {
  // Auth
  'auth.login': { fr: 'Connexion', en: 'Login' },
  'auth.register': { fr: 'Inscription', en: 'Sign Up' },
  'auth.email': { fr: 'Email', en: 'Email' },
  'auth.password': { fr: 'Mot de passe', en: 'Password' },
  'auth.firstName': { fr: 'Prénom', en: 'First Name' },
  'auth.lastName': { fr: 'Nom', en: 'Last Name' },
  'auth.phone': { fr: 'Téléphone', en: 'Phone' },
  'auth.forgotPassword': { fr: 'Mot de passe oublié ?', en: 'Forgot password?' },
  'auth.noAccount': { fr: 'Pas de compte ?', en: 'No account?' },
  'auth.hasAccount': { fr: 'Déjà un compte ?', en: 'Already have an account?' },
  'auth.logout': { fr: 'Déconnexion', en: 'Logout' },
  'auth.yourElectricMobility': { fr: 'Votre mobilité électrique', en: 'Your electric mobility' },
  'auth.confirmPassword': { fr: 'Confirmer le mot de passe', en: 'Confirm Password' },
  'auth.atLeast8Chars': { fr: 'Au moins 8 caractères', en: 'At least 8 characters' },
  'auth.passwordMinLength': { fr: 'Au moins 8 caractères', en: 'At least 8 characters' },
  'auth.passwordHasLowercase': { fr: 'Au moins 1 lettre minuscule', en: 'At least 1 lowercase letter' },
  'auth.passwordHasUppercase': { fr: 'Au moins 1 lettre majuscule', en: 'At least 1 uppercase letter' },
  'auth.passwordHasNumber': { fr: 'Au moins 1 chiffre', en: 'At least 1 number' },
  'auth.backToLogin': { fr: 'Retour à la connexion', en: 'Back to login' },
  'auth.emailSent': { fr: 'Email envoyé !', en: 'Email sent!' },
  'auth.checkInbox': { fr: 'Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.', en: 'Check your inbox and click the link to reset your password.' },
  'auth.newPassword': { fr: 'Nouveau mot de passe', en: 'New password' },
  'auth.passwordReset': { fr: 'Mot de passe réinitialisé !', en: 'Password reset!' },
  'auth.passwordResetSuccess': { fr: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.', en: 'Your password has been reset successfully. You can now log in with your new password.' },
  'auth.enterPassword': { fr: 'Entrez votre mot de passe', en: 'Enter your password' },
  'auth.confirmYourPassword': { fr: 'Confirmez votre mot de passe', en: 'Confirm your password' },
  'auth.sendLink': { fr: 'Envoyer le lien', en: 'Send link' },
  'auth.resetPasswordAction': { fr: 'Réinitialiser le mot de passe', en: 'Reset password' },
  'auth.sending': { fr: 'Envoi en cours...', en: 'Sending...' },
  'auth.resetting': { fr: 'Réinitialisation...', en: 'Resetting...' },
  'auth.forgotPasswordDescription': { fr: 'Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.', en: 'Enter your email and we will send you a link to reset your password.' },
  'auth.emailSentDescription': { fr: 'Nous avons envoyé un lien de réinitialisation à votre adresse email.', en: 'We have sent a reset link to your email address.' },
  'auth.newPasswordDescription': { fr: 'Votre nouveau mot de passe doit être différent des mots de passe précédents.', en: 'Your new password must be different from previous passwords.' },
  'auth.mustBeLoggedIn': { fr: 'Vous devez être connecté', en: 'You must be logged in' },
  'auth.emailNotVerified.title': { fr: 'Email Non Vérifié', en: 'Email Not Verified' },
  'auth.emailNotVerified.message': { fr: 'Veuillez vérifier votre email avant de vous connecter. Vérifiez votre boîte de réception et cliquez sur le lien de vérification.', en: 'Please verify your email before logging in. Check your inbox and click on the verification link.' },
  'auth.resendVerification': { fr: "Renvoyer l'email", en: 'Resend Email' },
  'auth.verificationResent': { fr: "Email de vérification renvoyé avec succès !", en: 'Verification email resent successfully!' },
  'auth.verificationSent.title': { fr: 'Email Envoyé', en: 'Email Sent' },
  'auth.verificationSent.message': { fr: "Un nouvel email de vérification a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception.", en: 'A new verification email has been sent to your address. Please check your inbox.' },
  'auth.emailAlreadyVerified': { fr: 'Votre email est déjà vérifié. Vous pouvez vous connecter.', en: 'Your email is already verified. You can log in.' },
  'auth.resendVerificationError': { fr: "Erreur lors de l'envoi de l'email de vérification", en: 'Error resending verification email' },
  'auth.verificationEmailSent.message': { fr: 'Un email de vérification a été envoyé à votre adresse. Veuillez vérifier votre boîte de réception et cliquer sur le lien pour activer votre compte.', en: 'A verification email has been sent to your address. Please check your inbox and click the link to activate your account.' },
  'auth.verificationResentShort': { fr: 'Email de vérification renvoyé !', en: 'Verification email resent!' },
  'auth.verificationResendError': { fr: 'Erreur lors de l\'envoi de l\'email', en: 'Error sending email' },
  'auth.register.successMessage': { fr: 'Votre compte a été créé avec succès ! Veuillez vérifier votre email pour activer votre compte.', en: 'Your account has been created successfully! Please verify your email to activate your account.' },
  'auth.email.verificationSent': { fr: 'Email de vérification envoyé', en: 'Verification email sent' },
  'auth.email.resendVerification': { fr: 'Renvoyer l\'email de vérification', en: 'Resend verification email' },

  // Validation messages
  'validation.fillAllFields': { fr: 'Veuillez remplir tous les champs', en: 'Please fill in all fields' },
  'validation.invalidEmail': { fr: 'Adresse email invalide', en: 'Invalid email address' },
  'validation.invalidPhone': { fr: 'Numéro de téléphone invalide', en: 'Invalid phone number' },
  'validation.passwordsNoMatch': { fr: 'Les mots de passe ne correspondent pas', en: 'Passwords do not match' },
  'validation.passwordMinLength': { fr: 'Le mot de passe doit contenir au moins 8 caractères', en: 'Password must be at least 8 characters' },
  'validation.passwordRequirements': { fr: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre', en: 'Password must contain at least 8 characters, one uppercase, one lowercase letter and one number' },
  'validation.enterEmail': { fr: 'Veuillez saisir votre adresse email', en: 'Please enter your email address' },

  // Error messages
  'error.invalidCredentials': { fr: 'Email ou mot de passe incorrect', en: 'Invalid email or password' },
  'error.networkError': { fr: 'Erreur de connexion', en: 'Network error' },
  'error.validationError': { fr: 'Données invalides', en: 'Invalid data' },
  'error.userAlreadyExists': { fr: 'Un compte existe déjà avec cet email', en: 'An account already exists with this email' },
  'error.serverError': { fr: 'Erreur serveur', en: 'Server error' },
  'error.serviceUnavailable': { fr: 'Service indisponible', en: 'Service unavailable' },
  'error.userNotFound': { fr: 'Aucun compte trouvé avec cette adresse email', en: 'No account found with this email address' },
  'error.invalidToken': { fr: 'Lien de réinitialisation invalide ou expiré', en: 'Invalid or expired reset link' },
  'error.invalidData': { fr: 'Données invalides', en: 'Invalid data' },
  'error.occurred': { fr: 'Une erreur est survenue', en: 'An error occurred' },
  'error.resetPasswordError': { fr: 'Erreur lors de la réinitialisation', en: 'Error resetting password' },
  'error.invalidResetLink': { fr: 'Lien de réinitialisation invalide', en: 'Invalid reset link' },
  'error.serviceUnavailableMessage': { fr: 'Le serveur est temporairement indisponible. Veuillez réessayer dans quelques instants.', en: 'The server is temporarily unavailable. Please try again in a few moments.' },
  'error.connectionError': { fr: 'Erreur de connexion au serveur. Vérifiez votre connexion internet.', en: 'Server connection error. Check your internet connection.' },
  'error.invalidJsonResponse': { fr: 'Réponse JSON invalide du serveur', en: 'Invalid JSON response from server' },
  'error.failedAfterRetries': { fr: 'Échec après plusieurs tentatives', en: 'Failed after retries' },
  'error.badGateway': { fr: 'Erreur de passerelle (502). Le serveur est temporairement indisponible. Veuillez réessayer dans quelques instants.', en: 'Bad Gateway error (502). The server is temporarily unavailable. Please try again in a few moments.' },

  // Success messages
  'success.loginSuccessful': { fr: 'Connexion réussie !', en: 'Login successful!' },
  'success.accountCreated': { fr: 'Compte créé avec succès !', en: 'Account created successfully!' },
  'success.registrationSuccessful': { fr: 'Inscription réussie !', en: 'Registration successful!' },

  // Placeholders
  'placeholder.email': { fr: 'exemple@email.com', en: 'example@email.com' },
  'placeholder.yourEmail': { fr: 'votre@email.com', en: 'your@email.com' },
  'placeholder.password': { fr: '••••••••', en: '••••••••' },
  'placeholder.firstName': { fr: 'Jean', en: 'John' },
  'placeholder.lastName': { fr: 'Pierre', en: 'Doe' },
  'placeholder.phone': { fr: '690635827', en: '690635827' },

  // Navigation
  'nav.home': { fr: 'Accueil', en: 'Home' },
  'nav.map': { fr: 'Carte', en: 'Map' },
  'nav.scan': { fr: 'Scanner', en: 'Scan' },
  'nav.rides': { fr: 'Trajets', en: 'Rides' },
  'nav.profile': { fr: 'Profil', en: 'Profile' },
  'nav.notifications': { fr: 'Notifications', en: 'Notifications' },

  // Notifications sections
  'notifications.unread': { fr: 'non lues', en: 'unread' },
  'notifications.markAllRead': { fr: 'Tout marquer lu', en: 'Mark all read' },
  'notifications.new': { fr: 'Nouveau', en: 'New' },
  'notifications.empty.title': { fr: 'Aucune notification', en: 'No notifications' },
  'notifications.empty.description': { fr: 'Vous n\'avez aucune notification pour le moment', en: 'You have no notifications at the moment' },
  'notifications.sections.unread': { fr: 'Non lues', en: 'Unread' },
  'notifications.sections.previous': { fr: 'Précédentes', en: 'Previous' },

  // Home
  'home.welcome': { fr: 'Bienvenue', en: 'Welcome' },
  'home.depositBlocked.title': { fr: 'Service bloqué - Caution insuffisante', en: 'Service blocked - Insufficient deposit' },
  'home.depositBlocked.current': { fr: 'Votre caution actuelle de {amount} XOF est insuffisante.', en: 'Your current deposit of {amount} XOF is insufficient.' },
  'home.depositBlocked.required': { fr: 'Minimum requis : {amount} XOF', en: 'Required minimum: {amount} XOF' },
  'home.depositBlocked.action': { fr: 'Recharger votre caution →', en: 'Top up your deposit →' },
  'home.findBike': { fr: 'Trouver un vélo', en: 'Find a Bike' },
  'home.scanQR': { fr: 'Scanner QR', en: 'Scan QR' },
  'home.myRides': { fr: 'Mes trajets', en: 'My Rides' },
  'home.wallet': { fr: 'Portefeuille', en: 'Wallet' },
  'home.balance': { fr: 'Solde', en: 'Balance' },
  'home.topUp': { fr: 'Recharger', en: 'Top Up' },
  'home.recentRides': { fr: 'Trajets récents', en: 'Recent Rides' },
  'home.noRides': { fr: 'Aucun trajet pour le moment', en: 'No rides yet' },
  'home.findBikeDescription': { fr: 'Trouvez un vélo et commencez votre trajet', en: 'Find a bike and start your ride' },
  'home.totalTime': { fr: 'Temps total', en: 'Total Time' },
  'home.distance': { fr: 'Distance', en: 'Distance' },
  'home.viewAll': { fr: 'Voir tout', en: 'View all' },
  'home.loadingRides': { fr: 'Chargement des trajets...', en: 'Loading rides...' },
  'home.loadingError': { fr: 'Erreur de chargement', en: 'Loading error' },
  'home.startRide': { fr: 'Commencer un trajet', en: 'Start a ride' },
  'home.accountManagement': { fr: 'Gestion de compte', en: 'Account Management' },
  'home.accountManagementDesc': { fr: 'Forfaits, transactions, signalements', en: 'Plans, transactions, reports' },
  'home.loadingWallet': { fr: 'Chargement...', en: 'Loading...' },

  // Map & Bikes
  'map.view': { fr: 'Voir', en: 'View' },
  'map.interactive': { fr: 'Carte Interactive', en: 'Interactive Map' },
  'map.bikesAvailable': { fr: '{{count}} vélos disponibles', en: '{{count}} bikes available' },
  'map.searchPlaceholder': { fr: 'Rechercher un vélo...', en: 'Search for a bike...' },
  'map.filters.title': { fr: 'Filtres de recherche', en: 'Search Filters' },
  'map.filters.description': { fr: 'Personnalisez votre recherche de vélos', en: 'Customize your bike search' },
  'map.filters.searchMode': { fr: 'Mode de recherche', en: 'Search Mode' },
  'map.filters.nearby': { fr: 'À proximité', en: 'Nearby' },
  'map.filters.byArea': { fr: 'Par quartier', en: 'By Area' },
  'map.filters.selectArea': { fr: 'Sélectionner un quartier', en: 'Select an Area' },
  'map.filters.chooseArea': { fr: 'Choisir un quartier...', en: 'Choose an area...' },
  'map.filters.searchArea': { fr: 'Rechercher un quartier...', en: 'Search for an area...' },
  'map.filters.noAreaFound': { fr: 'Aucun quartier trouvé', en: 'No area found' },
  'map.filters.maxDistance': { fr: 'Distance maximale', en: 'Maximum Distance' },
  'map.filters.minBattery': { fr: 'Batterie minimale', en: 'Minimum Battery' },
  'map.bikesInArea': { fr: 'Vélos dans {{area}}', en: 'Bikes in {{area}}' },
  'map.nearbyBikes': { fr: 'Vélos à proximité', en: 'Nearby Bikes' },
  'map.available': { fr: 'disponibles', en: 'available' },
  'map.noBikesFound': { fr: 'Aucun vélo trouvé', en: 'No bikes found' },
  'map.adjustFilters': { fr: 'Essayez de modifier vos filtres de recherche', en: 'Try adjusting your search filters' },
  'map.modifyFilters': { fr: 'Modifier les filtres', en: 'Adjust Filters' },
  'map.unlock': { fr: 'Déverrouiller', en: 'Unlock' },
  'map.reserve': { fr: 'Réserver', en: 'Reserve' },
  'map.distance': { fr: 'Distance', en: 'Distance' },
  'map.priceUnavailable': { fr: 'Prix indisponible', en: 'Price unavailable' },

  // Bike Details
  'bike.details': { fr: 'Détails du vélo', en: 'Bike Details' },
  'bike.model': { fr: 'Modèle', en: 'Model' },
  'bike.battery': { fr: 'Batterie', en: 'Battery' },
  'bike.range': { fr: 'Autonomie', en: 'Range' },
  'bike.price': { fr: 'Prix', en: 'Price' },
  'bike.perMinute': { fr: '/min', en: '/min' },
  'bike.features': { fr: 'Caractéristiques', en: 'Features' },
  'bike.getDirections': { fr: 'Itinéraire', en: 'Directions' },
  'bike.location': { fr: 'Localisation', en: 'Location' },
  'bike.unavailable': { fr: 'Ce vélo n\'est pas disponible pour le moment', en: 'This bike is not available at the moment' },
  'bike.unlockConfirm.title': { fr: 'Déverrouiller le vélo ?', en: 'Unlock bike?' },
  'bike.unlockConfirm.description': { fr: 'Vous allez commencer un trajet avec {{bikeName}}. Coût: {{price}} XOF/h', en: 'You\'re about to start a ride with {{bikeName}}. Cost: {{price}} XOF/h' },
  'bike.reserveConfirm.title': { fr: 'Réserver le vélo ?', en: 'Reserve bike?' },
  'bike.reserveConfirm.description': { fr: 'Le vélo {{bikeName}} sera réservé pour vous pendant 15 minutes.', en: '{{bikeName}} will be reserved for you for 15 minutes.' },
  'bike.details.serviceBlocked': { fr: 'Utilisation des vélos bloquée', en: 'Bike usage blocked' },
  'bike.details.insufficientDeposit': { fr: 'Votre caution est insuffisante pour utiliser ce service.', en: 'Your deposit is insufficient to use this service.' },
  'bike.details.estimatedCost': { fr: 'Estimation 30 min: {amount} XOF', en: '30 min estimate: {amount} XOF' },
  'bike.details.activePlan': { fr: 'Forfait actif: {plan}', en: 'Active plan: {plan}' },
  'bike.details.planType': { fr: 'Type: {type} - Expire le {date}', en: 'Type: {type} - Expires on {date}' },
  'bike.details.reservedBike': { fr: 'Vélo réservé: {code}', en: 'Reserved bike: {code}' },
  'bike.details.maintenanceMessage': { fr: 'Ce vélo est actuellement en maintenance pour votre sécurité', en: 'This bike is currently under maintenance for your safety' },
  'bike.details.unlockBlocked': { fr: 'Caution insuffisante', en: 'Insufficient deposit' },
  'bike.details.reservationBlocked': { fr: 'Réservation bloquée', en: 'Reservation blocked' },
  'bike.details.depositWarning': { fr: 'Pour débloquer l\'accès, rechargez votre caution à {amount} XOF minimum.', en: 'To unlock access, top up your deposit to at least {amount} XOF.' },
  'bike.details.hasActiveRide': { fr: 'Trajet en cours', en: 'Ride in progress' },
  'bike.details.activeRideError': { fr: 'Vous avez déjà un trajet en cours. Terminez-le avant de déverrouiller un autre vélo.', en: 'You already have a ride in progress. Finish it before unlocking another bike.' },
  'bike.details.activeRideWarning': { fr: 'Vous avez un trajet en cours. Terminez-le avant de déverrouiller un autre vélo.', en: 'You have a ride in progress. Finish it before unlocking another bike.' },

  // Unlock Request
  'unlock.requestSent': { fr: 'Demande de déverrouillage envoyée. Un administrateur va valider votre demande.', en: 'Unlock request sent. An administrator will validate your request.' },
  'unlock.error': { fr: 'Erreur lors de la demande', en: 'Error sending request' },
  
  // Lock Request
  'lock.requestSent': { fr: 'Demande de verrouillage envoyée. Un administrateur va valider la fin de votre trajet.', en: 'Lock request sent. An administrator will validate the end of your ride.' },
  'lock.requestError': { fr: 'Erreur lors de la demande de verrouillage', en: 'Error sending lock request' },
  'lock.requestButton': { fr: 'Demander le verrouillage', en: 'Request Lock' },
  'lock.requestAlreadyPending': { fr: 'Une demande de verrouillage est déjà en attente pour ce vélo. Veuillez patienter.', en: 'A lock request is already pending for this bike. Please wait.' },
  'lock.adminValidation': { fr: 'Le verrouillage nécessite une validation par un administrateur pour vérifier que le vélo est correctement positionné.', en: 'Locking requires administrator validation to verify the bike is properly positioned.' },

  // Ride
  'ride.inProgress': { fr: 'Trajet en cours', en: 'Ride in Progress' },
  'ride.duration': { fr: 'Durée', en: 'Duration' },
  'ride.distance': { fr: 'Distance', en: 'Distance' },
  'ride.currentCost': { fr: 'Coût actuel', en: 'Current Cost' },
  'ride.endRide': { fr: 'Terminer le trajet', en: 'End Ride' },
  'ride.pauseRide': { fr: 'Mettre en pause', en: 'Pause Ride' },
  'ride.reportIssue': { fr: 'Signaler un problème', en: 'Report Issue' },
  'ride.history': { fr: 'Historique', en: 'History' },
  'ride.completed': { fr: 'Terminé', en: 'Completed' },
  'ride.cancelled': { fr: 'Annulé', en: 'Cancelled' },

  // Ride History
  'ride.loadingHistory': { fr: 'Chargement de l\'historique...', en: 'Loading history...' },
  'ride.totalDistance': { fr: 'Distance totale', en: 'Total Distance' },
  'ride.totalTime': { fr: 'Temps total', en: 'Total Time' },
  'ride.totalSpent': { fr: 'Total dépensé', en: 'Total Spent' },
  'ride.filterAll': { fr: 'Tous', en: 'All' },
  'ride.filterCompleted': { fr: 'Terminés', en: 'Completed' },
  'ride.filterCancelled': { fr: 'Annulés', en: 'Cancelled' },
  'ride.unknownBike': { fr: 'Vélo inconnu', en: 'Unknown Bike' },
  'ride.unknownLocation': { fr: 'Localisation inconnue', en: 'Unknown Location' },
  'ride.startLocation': { fr: 'Départ', en: 'Start Location' },
  'ride.loadingMore': { fr: 'Chargement...', en: 'Loading...' },
  'ride.noRidesInCategory': { fr: 'Aucun trajet dans cette catégorie', en: 'No rides in this category' },
  'ride.monthSummary': { fr: 'Résumé du mois', en: 'Month Summary' },
  'ride.numberOfRides': { fr: 'Nombre de trajets', en: 'Number of Rides' },

  // Ride In Progress
  'ride.failedToLoad': { fr: 'Erreur lors du chargement du trajet', en: 'Failed to load ride' },
  'ride.loading': { fr: 'Chargement...', en: 'Loading...' },
  'ride.noActiveRide': { fr: 'Aucun trajet actif', en: 'No active ride' },
  'ride.inProgressMessage': { fr: 'Trajet en cours', en: 'Ride in Progress' },
  'ride.gpsActive': { fr: 'GPS actif - Suivi en temps réel', en: 'GPS active - Real-time tracking' },
  'ride.pausedMessage': { fr: 'Trajet en pause', en: 'Ride Paused' },
  'ride.currentBike': { fr: 'Vélo actuel', en: 'Current Bike' },
  'ride.elapsedTime': { fr: 'Temps écoulé', en: 'Elapsed Time' },
  'ride.rate': { fr: 'Tarif horaire', en: 'Hourly Rate' },
  'ride.resume': { fr: 'Reprendre', en: 'Resume' },
  'ride.pause': { fr: 'Pause', en: 'Pause' },
  'ride.safetyReminder': { fr: 'Roulez prudemment et respectez le code de la route', en: 'Ride safely and follow traffic rules' },
  'ride.resumed': { fr: 'Trajet repris', en: 'Ride resumed' },
  'ride.paused': { fr: 'Trajet mis en pause', en: 'Ride paused' },

  // Ride Details
  'ride.details': { fr: 'Détails du trajet', en: 'Ride Details' },
  'ride.details.tripInformation': { fr: 'Informations du trajet', en: 'Trip Information' },
  'ride.details.bikeInformation': { fr: 'Information vélo', en: 'Bike Information' },
  'ride.details.startTime': { fr: 'Heure de début', en: 'Start Time' },
  'ride.details.endTime': { fr: 'Heure de fin', en: 'End Time' },
  'ride.details.totalDuration': { fr: 'Durée totale', en: 'Total Duration' },
  'ride.details.totalDistance': { fr: 'Distance totale', en: 'Total Distance' },
  'ride.details.totalCost': { fr: 'Coût total', en: 'Total Cost' },
  'ride.details.startLocation': { fr: 'Lieu de départ', en: 'Start Location' },
  'ride.details.endLocation': { fr: 'Lieu d\'arrivée', en: 'End Location' },
  'ride.details.mapLoading': { fr: 'Chargement de la carte...', en: 'Loading map...' },
  'ride.details.viewOnMap': { fr: 'Voir sur la carte', en: 'View on map' },
  'ride.details.bikeCode': { fr: 'Code du vélo', en: 'Bike Code' },
  'ride.details.bikeModel': { fr: 'Modèle', en: 'Model' },
  'ride.details.batteryAtStart': { fr: 'Batterie au départ', en: 'Battery at start' },
  'ride.details.batteryAtEnd': { fr: 'Batterie à l\'arrivée', en: 'Battery at end' },
  'ride.details.rideStatus': { fr: 'Statut', en: 'Status' },
  'ride.details.status.completed': { fr: 'Terminé', en: 'Completed' },
  'ride.details.status.inProgress': { fr: 'En cours', en: 'In Progress' },
  'ride.details.status.cancelled': { fr: 'Annulé', en: 'Cancelled' },
  'ride.details.status.paused': { fr: 'En pause', en: 'Paused' },
  'ride.details.paymentMethod': { fr: 'Mode de paiement', en: 'Payment Method' },
  'ride.details.paymentStatus': { fr: 'Statut paiement', en: 'Payment Status' },
  'ride.details.payment.paid': { fr: 'Payé', en: 'Paid' },
  'ride.details.payment.pending': { fr: 'En attente', en: 'Pending' },
  'ride.details.payment.refunded': { fr: 'Remboursé', en: 'Refunded' },
  'ride.details.noEndLocation': { fr: 'Non spécifié', en: 'Not specified' },
  'ride.details.invalidCoordinates': { fr: 'Coordonnées invalides', en: 'Invalid coordinates' },
  'ride.details.shareRide': { fr: 'Partager le trajet', en: 'Share ride' },
  'ride.details.reportIssue': { fr: 'Signaler un problème', en: 'Report issue' },
  'ride.details.needHelp': { fr: 'Besoin d\'aide ?', en: 'Need help?' },
  'ride.details.contactSupport': { fr: 'Contacter le support', en: 'Contact support' },
  'ride.details.rideSummary': { fr: 'Résumé du trajet', en: 'Ride Summary' },
  'ride.details.ecoImpact': { fr: 'Impact écologique', en: 'Eco impact' },
  'ride.details.co2Saved': { fr: 'CO₂ économisé', en: 'CO₂ saved' },
  'ride.details.caloriesBurned': { fr: 'Calories brûlées', en: 'Calories burned' },
  'ride.details.estimatedSavings': { fr: 'Économies estimées', en: 'Estimated savings' },
  'ride.notFound': { fr: 'Trajet non trouvé', en: 'Ride not found' },
  'ride.loadError': { fr: 'Erreur lors du chargement du trajet', en: 'Error loading ride' },
  'ride.loadingDetails': { fr: 'Chargement des détails...', en: 'Loading details...' },
  'ride.bike': { fr: 'Vélo', en: 'Bike' },
  'ride.dateTime': { fr: 'Date et heure', en: 'Date & Time' },
  'ride.route': { fr: 'Itinéraire', en: 'Route' },
  'ride.start': { fr: 'Départ', en: 'Start' },
  'ride.end': { fr: 'Arrivée', en: 'End' },
  'ride.notAvailable': { fr: 'Non disponible', en: 'Not available' },
  'ride.paymentDetails': { fr: 'Détails de paiement', en: 'Payment Details' },
  'ride.baseCost': { fr: 'Coût de base', en: 'Base Cost' },
  'ride.total': { fr: 'Total', en: 'Total' },

  // Subscription Plans
  'subscription.active': { fr: 'Forfait actif: {plan}', en: 'Active plan: {plan}' },
  'subscription.included': { fr: 'Inclus dans votre forfait {plan}', en: 'Included in your {plan} plan' },
  'subscription.overtime': { fr: 'Overtime avec forfait: {percentage}% de réduction appliquée', en: 'Overtime with plan: {percentage}% discount applied' },
  'subscription.normalRate': { fr: 'Tarif normal - sera déduit de votre portefeuille', en: 'Normal rate - will be deducted from your wallet' },
  'payment.toPay': { fr: 'À payer', en: 'To pay' },
  'payment.included': { fr: 'Inclus', en: 'Included' },
  'payment.willBeDeducted': { fr: 'À déduire du portefeuille', en: 'To be deducted from wallet' },
  'payment.includedInPlan': { fr: 'Inclus dans le forfait', en: 'Included in plan' },
  'subscription.currency': { fr: 'XAF', en: 'XAF' },
  'subscription.duration': { fr: 'Nombre de jours', en: 'Number of days' },
  'subscription.hours': { fr: 'Période', en: 'Period' },
  'subscription.subscribe': { fr: 'Souscrire', en: 'Subscribe' },
  'subscription.subscribeButton': { fr: 'Souscrire pour {price} FCFA', en: 'Subscribe for {price} FCFA' },
  'subscription.subscribing': { fr: 'Souscription...', en: 'Subscribing...' },
  'subscription.selectPlanError': { fr: 'Veuillez sélectionner un plan', en: 'Please select a plan' },
  'subscription.footer': { fr: 'Le montant sera déduit de votre portefeuille. Vous pouvez annuler votre abonnement à tout moment.', en: 'The amount will be deducted from your wallet. You can cancel your subscription at any time.' },
  'subscription.fullyIncluded': { fr: 'Entièrement inclus dans votre abonnement', en: 'Fully included in your subscription' },
  'subscription.partiallyIncluded': { fr: '{coveredDays} jour(s) inclus, {remainingDays} jour(s) à {extraCost} XOF', en: '{coveredDays} day(s) included, {remainingDays} day(s) at {extraCost} XOF' },
  'subscription.afterExpiry': { fr: 'La réservation commence après la fin de votre abonnement', en: 'Reservation starts after your subscription expires' },
  'subscription.validUntil': { fr: 'Valide jusqu\'au {date} ({days} jour(s) restant(s))', en: 'Valid until {date} ({days} day(s) remaining)' },
  'subscription.plans.title': { fr: 'Choisir un forfait', en: 'Choose a Plan' },
  'subscription.plans.selectPlan': { fr: 'Sélectionnez votre plan tarifaire', en: 'Select your pricing plan' },
  'subscription.plans.selectPackage': { fr: 'Sélectionnez votre plan tarifaire', en: 'Select your pricing plan' },
  'subscription.plans.selectFormula': { fr: 'Sélectionnez votre formule spécifique', en: 'Select your specific plan' },
  'subscription.plans.selectDuration': { fr: 'Choisissez la durée de votre forfait', en: 'Choose your plan duration' },
  'subscription.plans.hourlyRate': { fr: 'Tarif horaire', en: 'Hourly rate' },
  'subscription.plans.dailyRate': { fr: 'Tarif journalier', en: 'Daily rate' },
  'subscription.plans.weeklyRate': { fr: 'Tarif hebdomadaire', en: 'Weekly rate' },
  'subscription.plans.monthlyRate': { fr: 'Tarif mensuel', en: 'Monthly rate' },
  'subscription.plans.currency': { fr: 'FCFA', en: 'FCFA' },
  'subscription.plans.discount': { fr: 'Réduction', en: 'Discount' },
  'subscription.plans.popular': { fr: 'Populaire', en: 'Popular' },

  // Package Types
  'subscription.package.hourly': { fr: 'Forfait Horaire', en: 'Hourly Plan' },
  'subscription.package.hourlyDesc': { fr: 'Valable 1 heure', en: 'Valid 1 hour' },
  'subscription.package.daily': { fr: 'Forfait Journalier', en: 'Daily Plan' },
  'subscription.package.dailyDesc': { fr: 'Valable 24h', en: 'Valid 24h' },
  'subscription.package.weekly': { fr: 'Forfait Hebdomadaire', en: 'Weekly Plan' },
  'subscription.package.weeklyDesc': { fr: 'Valable 7 jours', en: 'Valid 7 days' },
  'subscription.package.monthly': { fr: 'Forfait Mensuel', en: 'Monthly Plan' },
  'subscription.package.monthlyDesc': { fr: 'Valable 30 jours', en: 'Valid 30 days' },

  // Subscription Summary
  'subscription.summary.title': { fr: 'Résumé de votre abonnement', en: 'Subscription Summary' },
  'subscription.summary.plan': { fr: 'Plan :', en: 'Plan:' },
  'subscription.summary.package': { fr: 'Forfait :', en: 'Package:' },
  'subscription.summary.formula': { fr: 'Formule :', en: 'Formula:' },
  'subscription.summary.currentBalance': { fr: 'Solde actuel :', en: 'Current balance:' },
  'subscription.summary.totalPrice': { fr: 'Prix total :', en: 'Total price:' },

  // Insufficient Balance
  'subscription.insufficientBalance.title': { fr: 'Solde insuffisant', en: 'Insufficient Balance' },
  'subscription.insufficientBalance.message': { fr: 'Votre solde est insuffisant pour souscrire à ce forfait. Rechargez votre compte.', en: 'Your balance is insufficient to subscribe to this plan. Top up your account.' },
  'subscription.insufficientBalance.cancel': { fr: 'Annuler', en: 'Cancel' },
  'subscription.insufficientBalance.topUp': { fr: 'Recharger', en: 'Top Up' },

  // Success Messages
  'subscription.success.title': { fr: 'Abonnement confirmé', en: 'Subscription Confirmed' },
  'subscription.success.message': { fr: 'Votre abonnement {plan} - {package} est maintenant actif.', en: 'Your {plan} - {package} subscription is now active.' },
  'subscription.success.ok': { fr: 'OK', en: 'OK' },

  // After Hours
  'subscription.afterHours': { fr: 'Hors plage horaire', en: 'After hours' },

  // Current Subscription
  'subscription.current.active': { fr: 'Abonnement actif', en: 'Active Subscription' },
  'subscription.current.daysRemaining': { fr: 'Jours restants', en: 'Days remaining' },
  'subscription.current.expiresAt': { fr: 'Expire le', en: 'Expires on' },
  'subscription.current.hours': { fr: 'Plage horaire', en: 'Hours' },

  // Change Subscription
  'subscription.change.title': { fr: 'Changer', en: 'Change' },
  'subscription.change.selectNew': { fr: 'Choisir un nouveau forfait', en: 'Choose a new plan' },
  'subscription.change.success': { fr: 'Abonnement modifié avec succès', en: 'Subscription changed successfully' },

  // Cancel Subscription
  'subscription.cancel.title': { fr: 'Annuler', en: 'Cancel' },
  'subscription.cancel.confirm': { fr: 'Voulez-vous vraiment annuler votre abonnement ?', en: 'Do you really want to cancel your subscription?' },
  'subscription.cancel.yes': { fr: 'Oui, annuler', en: 'Yes, cancel' },
  'subscription.cancel.no': { fr: 'Non', en: 'No' },
  'subscription.cancel.success': { fr: 'Abonnement annulé', en: 'Subscription cancelled' },

  // Free Plans
  'subscription.freePlans.title': { fr: 'Vos forfaits gratuits', en: 'Your free plans' },
  'subscription.freePlans.free': { fr: 'Gratuit', en: 'Free' },
  'subscription.freePlans.daysRemaining': { fr: 'Jours restants', en: 'Days remaining' },
  'subscription.freePlans.expiresAt': { fr: 'Expire le', en: 'Expires on' },
  'subscription.freePlans.active': { fr: 'Actif', en: 'Active' },
  'subscription.freePlans.timeRange': { fr: 'Plage horaire', en: 'Time range' },
  'subscription.freePlans.activateBtn': { fr: 'Souscrire à ce forfait gratuit', en: 'Subscribe to this free plan' },
  'subscription.freePlans.activateSuccess': { fr: 'Forfait gratuit activé !', en: 'Free plan activated!' },
  'subscription.freePlans.activateError': { fr: "Erreur lors de l'activation", en: 'Activation error' },
  'subscription.freePlans.activeDesc': { fr: 'Ce forfait est actif — vos prochains trajets seront gratuits', en: 'This plan is active — your next rides will be free' },
  'subscription.freePlans.validUntil': { fr: 'À utiliser avant le', en: 'Valid until' },

  // Error Messages
  'subscription.error.loading': { fr: 'Erreur lors du chargement des plans', en: 'Error loading plans' },
  'subscription.error.selectFormula': { fr: 'Veuillez sélectionner une formule', en: 'Please select a formula' },
  'subscription.error.subscribing': { fr: 'Erreur lors de la souscription', en: 'Error subscribing' },

  // Price Display
  'price.daily': { fr: 'Journalier: {price} XOF', en: 'Daily: {price} XOF' },
  'price.monthly': { fr: 'Mensuel: {price} XOF', en: 'Monthly: {price} XOF' },
  'price.hourly': { fr: '{price} XOF/h', en: '{price} XOF/h' },

  // Wallet
  'wallet.title': { fr: 'Mon portefeuille', en: 'My Wallet' },
  'wallet.balance': { fr: 'Solde disponible', en: 'Available Balance' },
  'wallet.topUp': { fr: 'Recharger', en: 'Top Up' },
  'wallet.history': { fr: 'Historique', en: 'History' },
  'wallet.selectAmount': { fr: 'Sélectionner un montant', en: 'Select Amount' },
  'wallet.customAmount': { fr: 'Montant personnalisé', en: 'Custom Amount' },
  'wallet.paymentMethod': { fr: 'Méthode de paiement', en: 'Payment Method' },
  'wallet.orangeMoney': { fr: 'Orange Money', en: 'Orange Money' },
  'wallet.mobileMoney': { fr: 'Mobile Money', en: 'Mobile Money' },
  'wallet.confirm': { fr: 'Confirmer', en: 'Confirm' },
  'wallet.myCards': { fr: 'Mes cartes', en: 'My Cards' },
  'wallet.recentTransactions': { fr: 'Transactions récentes', en: 'Recent Transactions' },
  'wallet.noTransactions': { fr: 'Aucune transaction', en: 'No transactions' },
  'wallet.selectValidAmount': { fr: 'Veuillez sélectionner un montant valide', en: 'Please select a valid amount' },
  'wallet.minimumAmount': { fr: 'Le montant minimum est de 500 XOF', en: 'Minimum amount is 500 XOF' },
  'wallet.depositInitiated': { fr: 'Dépôt initié avec succès', en: 'Deposit initiated successfully' },
  'wallet.invalidAmount': { fr: 'Montant invalide', en: 'Invalid amount' },
  'wallet.depositError': { fr: 'Erreur lors du dépôt', en: 'Deposit error' },
  'wallet.loadError': { fr: 'Erreur de chargement', en: 'Loading error' },
  'wallet.selectAmountToTopUp': { fr: 'Sélectionnez le montant à recharger', en: 'Select the amount to top up' },
  'wallet.currentStatus': { fr: 'État actuel', en: 'Current Status' },
  'wallet.rechargeDeposit': { fr: 'Recharger la caution', en: 'Top up deposit' },
  'wallet.depositInsufficient': { fr: 'Caution insuffisante', en: 'Insufficient deposit' },
  'wallet.depositSufficient': { fr: 'Caution suffisante', en: 'Sufficient deposit' },
  'wallet.depositExceeded': { fr: 'Le dépôt total ne peut pas dépasser {max} XOF. Vous pouvez ajouter au maximum {allowed} XOF.', en: 'Total deposit cannot exceed {max} XOF. You can add at most {allowed} XOF.' },
  'wallet.currentDeposit': { fr: 'Caution actuelle :', en: 'Current deposit:' },
  'wallet.requiredDeposit': { fr: 'Caution requise :', en: 'Required deposit:' },
  'wallet.missingAmount': { fr: 'Montant manquant :', en: 'Missing amount:' },
  'wallet.availableBalance': { fr: 'Solde wallet disponible', en: 'Available wallet balance' },
  'wallet.insufficientBalance': { fr: 'Votre solde wallet est insuffisant pour recharger la caution complètement. Rechargez d\'abord votre portefeuille.', en: 'Your wallet balance is insufficient to fully recharge the deposit. Top up your wallet first.' },
  'wallet.quickAmounts': { fr: 'Montants rapides', en: 'Quick amounts' },
  'wallet.enterAmount': { fr: 'Saisir un montant', en: 'Enter amount' },
  'wallet.recharging': { fr: 'Recharge...', en: 'Recharging...' },
  'wallet.rechargeAmount': { fr: 'Recharger {amount} XOF', en: 'Recharge {amount} XOF' },
  'wallet.topUpWalletFirst': { fr: 'Recharger le portefeuille d\'abord', en: 'Top up wallet first' },
  'wallet.cashPayment': { fr: 'Paiement en espèces', en: 'Cash payment' },
  'wallet.pendingValidation': { fr: 'En attente de validation', en: 'Pending validation' },
  'wallet.validated': { fr: 'Validée', en: 'Validated' },
  'wallet.rejected': { fr: 'Rejetée', en: 'Rejected' },
  'wallet.modify': { fr: 'Modifier', en: 'Modify' },
  'wallet.modifyAmount': { fr: 'Modifier le montant', en: 'Modify amount' },
  'wallet.newAmount': { fr: 'Nouveau montant', en: 'New amount' },
  'wallet.cashRequestSuccess': { fr: 'Demande de recharge en espèces créée avec succès. Un administrateur va valider votre demande.', en: 'Cash top-up request created successfully. An administrator will validate your request.' },
  'wallet.cashRequestModified': { fr: 'Demande de recharge modifiée avec succès', en: 'Top-up request modified successfully' },
  'wallet.cashRequestCancelled': { fr: 'Demande de recharge annulée avec succès', en: 'Top-up request cancelled successfully' },
  'wallet.minimumCashAmount': { fr: 'Le montant minimum pour une recharge en espèces est de 500 FCFA', en: 'The minimum amount for a cash top-up is 500 FCFA' },
  'wallet.invalidCashAmount': { fr: 'Montant invalide pour la demande en espèces.', en: 'Invalid amount for cash request.' },
  'wallet.cashRequestError': { fr: 'Erreur lors de la création de la demande de recharge', en: 'Error creating top-up request' },
  'wallet.cashModifyError': { fr: 'Erreur lors de la modification de la demande', en: 'Error modifying request' },
  'wallet.cashCancelError': { fr: 'Erreur lors de l\'annulation de la demande', en: 'Error cancelling request' },
  'wallet.invalidAmountFormat': { fr: 'Montant invalide. Veuillez vérifier le format.', en: 'Invalid amount. Please check the format.' },
  'wallet.loadingWalletData': { fr: 'Erreur lors du chargement des données du portefeuille', en: 'Error loading wallet data' },

  // Transaction statuses
  'wallet.status.completed': { fr: 'Complété', en: 'Completed' },
  'wallet.status.pending': { fr: 'En attente', en: 'Pending' },
  'wallet.status.failed': { fr: 'Échoué', en: 'Failed' },
  'wallet.status.cancelled': { fr: 'Annulé', en: 'Cancelled' },
  
  // Transaction types
  'wallet.transaction.deposit': { fr: 'Dépôt', en: 'Deposit' },
  'wallet.transaction.ridePayment': { fr: 'Paiement trajet', en: 'Ride payment' },
  'wallet.transaction.refund': { fr: 'Remboursement', en: 'Refund' },
  'wallet.transaction.withdrawal': { fr: 'Retrait', en: 'Withdrawal' },

  // Profile
  'profile.title': { fr: 'Mon profil', en: 'My Profile' },
  'profile.personalInfo': { fr: 'Informations personnelles', en: 'Personal Information' },
  'profile.editProfile': { fr: 'Modifier le profil', en: 'Edit Profile' },
  'profile.language': { fr: 'Langue', en: 'Language' },
  'profile.notifications': { fr: 'Notifications', en: 'Notifications' },
  'profile.help': { fr: 'Aide', en: 'Help' },
  'profile.legal': { fr: 'Mentions légales', en: 'Legal' },
  'profile.appInfo': { fr: 'À propos & Mises à jour', en: 'About & Updates' },
  'profile.version': { fr: 'Version', en: 'Version' },
  'profile.security': { fr: 'Sécurité', en: 'Security' },
  'profile.chatSupport': { fr: 'Chat avec le support', en: 'Chat with support' },
  'profile.emailVerified': { fr: 'Email vérifié', en: 'Email verified' },
  'profile.emailNotVerified': { fr: 'Email non vérifié', en: 'Email not verified' },
  'profile.phoneVerified': { fr: 'Téléphone vérifié', en: 'Phone verified' },
  'profile.phoneNotVerified': { fr: 'Téléphone non vérifié', en: 'Phone not verified' },
  'profile.verificationStatus': { fr: 'Statut de vérification', en: 'Verification status' },
  'profile.emailVerification': { fr: 'Vérification email', en: 'Email verification' },
  'profile.phoneVerification': { fr: 'Vérification téléphone', en: 'Phone verification' },
  'profile.accountPendingVerification': { fr: 'Compte en attente de vérification', en: 'Account pending verification' },
  'profile.submitDocumentsToActivate': { fr: 'Soumettez vos documents pour activer votre compte', en: 'Submit your documents to activate your account' },
  'profile.submitDocuments': { fr: 'Soumettre les documents', en: 'Submit documents' },
  'profile.documentsPendingValidation': { fr: 'Documents en attente de validation', en: 'Documents pending validation' },
  'profile.documentsValidationMessage': { fr: 'Certains documents nécessitent encore la validation de l\'administrateur (photo de profil, preuve de localisation d\'activité)', en: 'Some documents still require administrator validation (profile photo, activity location proof)' },
  'profile.viewDocuments': { fr: 'Voir les documents', en: 'View documents' },
  'profile.noPhoneNumber': { fr: 'Aucun numéro', en: 'No phone number' },
  'profile.yourStats': { fr: 'Vos statistiques', en: 'Your statistics' },
  'profile.helpComingSoon': { fr: 'Page d\'aide bientôt disponible', en: 'Help page coming soon' },
  'profile.legalComingSoon': { fr: 'Page légale bientôt disponible', en: 'Legal page coming soon' },
  'profile.accountManagement': { fr: 'Gestion de compte', en: 'Account Management' },
  'profile.languageUpdated': { fr: 'Langue mise à jour', en: 'Language updated' },
  'profile.notificationsEnabled': { fr: 'Notifications activées', en: 'Notifications enabled' },
  'profile.notificationsDisabled': { fr: 'Notifications désactivées', en: 'Notifications disabled' },
  'profile.stats.km': { fr: 'km', en: 'km' },
  'profile.stats.rating': { fr: '{rating}/5', en: '{rating}/5' },

  // Profile sections
  'profile.sections.account': { fr: 'Compte', en: 'Account' },
  'profile.sections.preferences': { fr: 'Préférences', en: 'Preferences' },
  'profile.sections.support': { fr: 'Support', en: 'Support' },

  // Edit Profile
  'profile.edit.title': { fr: 'Modifier le profil', en: 'Edit Profile' },
  'profile.edit.changePhoto': { fr: 'Changer la photo', en: 'Change photo' },
  'profile.edit.firstName': { fr: 'Prénom', en: 'First Name' },
  'profile.edit.lastName': { fr: 'Nom', en: 'Last Name' },
  'profile.edit.email': { fr: 'Adresse email', en: 'Email address' },
  'profile.edit.phone': { fr: 'Numéro de téléphone', en: 'Phone number' },
  'profile.edit.emailVerified': { fr: 'Email vérifié', en: 'Email verified' },
  'profile.edit.phoneVerified': { fr: 'Téléphone vérifié', en: 'Phone verified' },
  'profile.edit.cancel': { fr: 'Annuler', en: 'Cancel' },
  'profile.edit.save': { fr: 'Enregistrer', en: 'Save' },
  'profile.edit.saving': { fr: 'Enregistrement...', en: 'Saving...' },
  'profile.edit.preview': { fr: 'Prévisualisation', en: 'Preview' },
  'profile.edit.previewDescription': { fr: 'Aperçu de votre nouvelle photo de profil', en: 'Preview of your new profile picture' },
  'profile.edit.confirmImage': { fr: 'Voulez-vous utiliser cette image comme photo de profil ?', en: 'Do you want to use this image as your profile picture?' },
  'profile.edit.confirm': { fr: 'Confirmer', en: 'Confirm' },
  'profile.edit.photoUpdated': { fr: 'Photo de profil mise à jour', en: 'Profile picture updated' },
  'profile.edit.photoUploadError': { fr: 'Erreur lors de l\'envoi de la photo', en: 'Error uploading photo' },
  'profile.edit.galleryPermissionDenied': { fr: 'Permission d\'accéder à la galerie refusée', en: 'Permission to access gallery denied' },
  'profile.edit.photoSelectionError': { fr: 'Erreur lors de la sélection de l\'image', en: 'Error selecting image' },
  'profile.edit.fillRequiredFields': { fr: 'Veuillez remplir tous les champs obligatoires', en: 'Please fill in all required fields' },
  'profile.edit.updateSuccess': { fr: 'Profil mis à jour avec succès', en: 'Profile updated successfully' },
  'profile.edit.updateError': { fr: 'Erreur lors de la mise à jour du profil', en: 'Error updating profile' },
  'profile.edit.documents': { fr: 'Mes documents', en: 'My Documents' },
  'profile.edit.updateDocuments': { fr: 'Mettre à jour mes documents', en: 'Update my documents' },
  'profile.edit.documentsHint': { fr: 'Pièce d\'identité, justificatif de domicile, selfie', en: 'ID card, proof of address, selfie' },

  // Security
  'security.title': { fr: 'Sécurité', en: 'Security' },
  'security.password': { fr: 'Mot de passe', en: 'Password' },
  'security.changePassword': { fr: 'Modifier le mot de passe', en: 'Change password' },
  'security.lastChanged': { fr: 'Dernière modification il y a 30 jours', en: 'Last changed 30 days ago' },
  'security.currentPassword': { fr: 'Mot de passe actuel', en: 'Current password' },
  'security.newPassword': { fr: 'Nouveau mot de passe', en: 'New password' },
  'security.confirmPassword': { fr: 'Confirmer le mot de passe', en: 'Confirm password' },
  'security.fillAllFields': { fr: 'Veuillez remplir tous les champs', en: 'Please fill in all fields' },
  'security.passwordsNoMatch': { fr: 'Les mots de passe ne correspondent pas', en: 'Passwords do not match' },
  'security.passwordMinLength': { fr: 'Le mot de passe doit contenir au moins 8 caractères', en: 'Password must be at least 8 characters' },
  'security.passwordChangeSuccess': { fr: 'Mot de passe modifié avec succès', en: 'Password changed successfully' },
  'security.passwordChangeError': { fr: 'Erreur lors du changement de mot de passe', en: 'Error changing password' },
  'security.passwordRequirements': { fr: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre', en: 'Password must contain at least 8 characters, one uppercase, one lowercase letter and one number' },
  'security.incorrectPassword': { fr: 'Mot de passe actuel incorrect', en: 'Current password is incorrect' },
  'security.samePassword': { fr: 'Le nouveau mot de passe doit être différent de l\'ancien', en: 'New password must be different from current password' },
  'security.authenticationMethods': { fr: 'Méthodes d\'authentification', en: 'Authentication methods' },
  'security.twoFactorAuth': { fr: 'Authentification à deux facteurs', en: 'Two-factor authentication' },
  'security.twoFactorDescription': { fr: 'Protection supplémentaire', en: 'Extra security' },
  'security.biometricAuth': { fr: 'Authentification biométrique', en: 'Biometric authentication' },
  'security.biometricDescription': { fr: 'Empreinte digitale / Face ID', en: 'Fingerprint / Face ID' },
  'security.authenticateToEnable': { fr: 'Authentifiez-vous pour activer la biométrie', en: 'Authenticate to enable biometrics' },
  'security.authenticateToTest': { fr: 'Testez l\'authentification biométrique', en: 'Test biometric authentication' },
  'security.usePasscode': { fr: 'Utiliser le code', en: 'Use passcode' },
  'security.biometricEnabled': { fr: 'Biométrie activée', en: 'Biometrics enabled' },
  'security.biometricDisabled': { fr: 'Biométrie désactivée', en: 'Biometrics disabled' },
  'security.biometricTestSuccess': { fr: 'Authentification biométrique réussie !', en: 'Biometric authentication successful!' },
  'security.biometricAuthFailed': { fr: 'Échec de l\'authentification biométrique', en: 'Biometric authentication failed' },
  'security.biometricNotAvailable': { fr: 'Biométrie non disponible sur cet appareil', en: 'Biometrics not available on this device' },
  'security.biometricNotAvailableWeb': { fr: 'La biométrie n\'est pas disponible sur le web', en: 'Biometrics are not available on web' },
  'security.biometricNotAvailableDescription': { fr: 'Configurez la biométrie dans les paramètres de votre appareil', en: 'Set up biometrics in your device settings' },
  'security.authenticationCancelled': { fr: 'Authentification annulée', en: 'Authentication cancelled' },
  'security.biometricError': { fr: 'Erreur d\'authentification biométrique', en: 'Biometric authentication error' },
  'security.testBiometric': { fr: 'Tester', en: 'Test' },
  'security.dangerZone': { fr: 'Zone de danger', en: 'Danger zone' },
  'security.deleteAccount': { fr: 'Supprimer le compte', en: 'Delete account' },
  'security.deleteWarning': { fr: 'Cette action est irréversible. Toutes vos données seront définitivement supprimées.', en: 'This action is irreversible. All your data will be permanently deleted.' },
  'security.deleteConfirmTitle': { fr: 'Supprimer le compte ?', en: 'Delete account?' },
  'security.deleteConfirmDescription': { fr: 'Cette action est irréversible. Êtes-vous absolument sûr de vouloir supprimer votre compte et toutes vos données ?', en: 'This action is irreversible. Are you absolutely sure you want to delete your account and all your data?' },
  'security.deletePermanently': { fr: 'Supprimer définitivement', en: 'Delete permanently' },
  'security.deleteSuccess': { fr: 'Compte supprimé avec succès', en: 'Account deleted successfully' },
  'security.deleteError': { fr: 'Erreur lors de la suppression du compte', en: 'Error deleting account' },

  // Account Management
  'accountManagement.title': { fr: 'Gestion de compte', en: 'Account Management' },
  'accountManagement.tabs.overview': { fr: 'Vue d\'ensemble', en: 'Overview' },
  'accountManagement.tabs.transactions': { fr: 'Transactions', en: 'Transactions' },
  'accountManagement.tabs.requests': { fr: 'Demandes', en: 'Requests' },
  'accountManagement.tabs.incidents': { fr: 'Signalements', en: 'Reports' },
  'accountManagement.currentSubscription': { fr: 'Forfait Actuel', en: 'Current Subscription' },
  'accountManagement.expiresOn': { fr: 'Expire le {date}', en: 'Expires on {date}' },
  'accountManagement.reservedBike': { fr: 'Vélo réservé: {code}', en: 'Reserved bike: {code}' },
  'accountManagement.daysRemaining': { fr: '{days} jours restants', en: '{days} days remaining' },
  'accountManagement.noActivePlan': { fr: 'Aucun forfait actif', en: 'No active plan' },
  'accountManagement.subscribeDescription': { fr: 'Souscrivez à un forfait pour bénéficier de tarifs avantageux et d\'une utilisation illimitée.', en: 'Subscribe to a plan to benefit from advantageous rates and unlimited usage.' },
  'accountManagement.subscribe': { fr: 'Souscrire', en: 'Subscribe' },
  'accountManagement.walletBalance': { fr: 'Solde Wallet', en: 'Wallet Balance' },
  'accountManagement.deposit': { fr: 'Caution', en: 'Deposit' },
  'accountManagement.serviceBlocked': { fr: 'Service bloqué - Caution insuffisante', en: 'Service blocked - Insufficient deposit' },
  'accountManagement.requiredMinimum': { fr: 'Minimum requis: {amount} XOF', en: 'Required minimum: {amount} XOF' },
  'accountManagement.currentAmount': { fr: 'Montant actuel: {amount} XOF', en: 'Current amount: {amount} XOF' },
  'accountManagement.missingAmount': { fr: 'Manquant: {amount} XOF', en: 'Missing: {amount} XOF' },
  'accountManagement.rechargeDeposit': { fr: 'Recharger la caution', en: 'Top up deposit' },
  'accountManagement.negativeBalance': { fr: 'Solde négatif: -{amount} XOF', en: 'Negative balance: -{amount} XOF' },
  'accountManagement.rechargeWallet': { fr: 'Recharger', en: 'Top up' },
  'accountManagement.reportProblem': { fr: 'Signaler un problème', en: 'Report problem' },
  'accountManagement.filters.type': { fr: 'Type', en: 'Type' },
  'accountManagement.filters.period': { fr: 'Période', en: 'Period' },
  'accountManagement.filters.all': { fr: 'Tous', en: 'All' },
  'accountManagement.filters.deposits': { fr: 'Dépôts', en: 'Deposits' },
  'accountManagement.filters.ridePayments': { fr: 'Paiements trajets', en: 'Ride payments' },
  'accountManagement.filters.refunds': { fr: 'Remboursements', en: 'Refunds' },
  'accountManagement.filters.depositRecharge': { fr: 'Recharge caution', en: 'Deposit top-up' },
  'accountManagement.filters.damageCharges': { fr: 'Frais dégâts', en: 'Damage charges' },
  'accountManagement.filters.subscriptionPayments': { fr: 'Forfaits', en: 'Subscriptions' },
  'accountManagement.filters.today': { fr: 'Aujourd\'hui', en: 'Today' },
  'accountManagement.filters.week': { fr: '7 derniers jours', en: 'Last 7 days' },
  'accountManagement.filters.month': { fr: '30 derniers jours', en: 'Last 30 days' },
  'accountManagement.savings': { fr: 'Économie: {amount} XOF grâce à votre forfait', en: 'Savings: {amount} XOF thanks to your plan' },
  'accountManagement.noTransactions': { fr: 'Aucune transaction trouvée', en: 'No transactions found' },
  'accountManagement.unlockRequests': { fr: 'Déverrouillages ({count})', en: 'Unlocks ({count})' },
  'accountManagement.lockRequests': { fr: 'Verrouillages ({count})', en: 'Locks ({count})' },
  'accountManagement.adminNote': { fr: 'Note admin: {note}', en: 'Admin note: {note}' },
  'accountManagement.rejectionReason': { fr: 'Rejeté: {reason}', en: 'Rejected: {reason}' },
  'accountManagement.rideDetails': { fr: 'Trajet: {minutes} min - {cost} XOF', en: 'Ride: {minutes} min - {cost} XOF' },
  'accountManagement.noRequests': { fr: 'Aucune demande trouvée', en: 'No requests found' },
  'accountManagement.myReports': { fr: 'Mes signalements', en: 'My Reports' },
  'accountManagement.newReport': { fr: 'Nouveau', en: 'New' },
  'accountManagement.refundAmount': { fr: 'Remboursement: {amount} XOF', en: 'Refund: {amount} XOF' },
  'accountManagement.details': { fr: 'Détails', en: 'Details' },
  'accountManagement.reservationDetails': { fr: 'Détails de la réservation', en: 'Reservation Details' },
  'accountManagement.edit': { fr: 'Modifier', en: 'Edit' },
  'accountManagement.noReports': { fr: 'Aucun signalement trouvé', en: 'No reports found' },
  'accountManagement.createFirstReport': { fr: 'Créer un premier signalement', en: 'Create first report' },

  // Transaction Statuses
  'status.completed': { fr: 'Terminé', en: 'Completed' },
  'status.pending': { fr: 'En attente', en: 'Pending' },
  'status.failed': { fr: 'Échoué', en: 'Failed' },
  'status.approved': { fr: 'Approuvé', en: 'Approved' },
  'status.rejected': { fr: 'Rejeté', en: 'Rejected' },
  'status.cancelled': { fr: 'Annulé', en: 'Cancelled' },
  'status.open': { fr: 'Ouvert', en: 'Open' },
  'status.in_progress': { fr: 'En cours', en: 'In Progress' },
  'status.resolved': { fr: 'Résolu', en: 'Resolved' },
  'status.closed': { fr: 'Fermé', en: 'Closed' },

  // Transaction Types
  'transaction.deposit': { fr: 'Dépôt', en: 'Deposit' },
  'transaction.ridePayment': { fr: 'Paiement trajet', en: 'Ride payment' },
  'transaction.refund': { fr: 'Remboursement', en: 'Refund' },
  'transaction.depositRecharge': { fr: 'Recharge caution', en: 'Deposit top-up' },
  'transaction.damageCharge': { fr: 'Frais de dégâts', en: 'Damage charge' },
  'transaction.subscriptionPayment': { fr: 'Paiement forfait', en: 'Subscription payment' },

  // Profile stats
  'profile.stats.rides': { fr: 'Trajets', en: 'Rides' },
  'profile.stats.carbonSaved': { fr: 'CO₂ économisé', en: 'CO₂ saved' },
  'profile.stats.averageRating': { fr: 'Note moyenne', en: 'Average rating' },

  // Logout confirmation
  'profile.logoutConfirm.title': { fr: 'Se déconnecter ?', en: 'Log out?' },
  'profile.logoutConfirm.description': { fr: 'Êtes-vous sûr de vouloir vous déconnecter ?', en: 'Are you sure you want to log out?' },

  // Incident
  'incident.report': { fr: 'Signaler un incident', en: 'Report Incident' },
  'incident.type': { fr: 'Type d\'incident', en: 'Incident Type' },
  'incident.description': { fr: 'Description', en: 'Description' },
  'incident.addPhotos': { fr: 'Ajouter des photos', en: 'Add Photos' },
  'incident.create.title': { fr: 'Signaler un problème', en: 'Report an Issue' },
  'incident.edit.title': { fr: 'Modifier le signalement', en: 'Edit Report' },
  'incident.selectBike': { fr: 'Vélo concerné *', en: 'Related Bike *' },
  'incident.selectProblemType': { fr: 'Type de problème *', en: 'Problem Type *' },
  'incident.detailedDescription': { fr: 'Description détaillée *', en: 'Detailed Description *' },
  'incident.descriptionPlaceholder': { fr: 'Décrivez le problème en détail (minimum 20 caractères)...', en: 'Describe the problem in detail (minimum 20 characters)...' },
  'incident.minimumCharacters': { fr: 'Minimum 20 caractères requis', en: 'Minimum 20 characters required' },
  'incident.sufficientDescription': { fr: 'Description suffisante', en: 'Sufficient description' },
  'incident.photos': { fr: 'Photos', en: 'Photos' },
  'incident.photosStronglyRecommended': { fr: '(fortement recommandées)', en: '(strongly recommended)' },
  'incident.photosOptional': { fr: '(optionnelles)', en: '(optional)' },
  'incident.photosHelpCritical': { fr: 'Les photos aident nos techniciens à diagnostiquer le problème rapidement', en: 'Photos help our technicians diagnose the problem quickly' },
  'incident.photosHelpGeneral': { fr: 'Ajoutez des photos pour nous aider à comprendre le problème', en: 'Add photos to help us understand the problem' },
  'incident.addPhoto': { fr: 'Ajouter une photo', en: 'Add Photo' },
  'incident.maxPhotos': { fr: 'Maximum 5 photos autorisées', en: 'Maximum 5 photos allowed' },
  'incident.submit': { fr: 'Créer le signalement', en: 'Create Report' },
  'incident.updating': { fr: 'Modification...', en: 'Updating...' },
  'incident.update': { fr: 'Modifier le signalement', en: 'Update Report' },
  'incident.creating': { fr: 'Création...', en: 'Creating...' },
  'incident.bikeSource.reserved': { fr: 'Vélo réservé', en: 'Reserved Bike' },
  'incident.bikeSource.current': { fr: 'Trajet en cours', en: 'Current Ride' },
  'incident.bikeSource.recent': { fr: 'Récemment utilisé', en: 'Recently Used' },
  'incident.criticalWarning.title': { fr: 'Signalement critique - Maintenance automatique', en: 'Critical Report - Automatic Maintenance' },
  'incident.criticalWarning.description': { fr: 'Ce type de problème mettra automatiquement le vélo en maintenance jusqu\'à validation par un administrateur. Cette mesure est importante pour la sécurité de tous les utilisateurs.', en: 'This type of problem will automatically put the bike in maintenance until validated by an administrator. This measure is important for everyone\'s safety.' },
  'incident.noBikes.title': { fr: 'Aucun vélo disponible pour signalement.', en: 'No bikes available for reporting.' },
  'incident.noBikes.requirements': { fr: 'Pour créer un signalement, vous devez :\n• Avoir un vélo réservé, OU\n• Être en cours de trajet, OU\n• Avoir récemment utilisé un vélo', en: 'To create a report, you must:\n• Have a reserved bike, OR\n• Be on an active ride, OR\n• Have recently used a bike' },
  'incident.help.noBikes': { fr: 'Pour signaler un problème, utilisez d\'abord un vélo ou effectuez une réservation.', en: 'To report a problem, first use a bike or make a reservation.' },
  'incident.help.withBikes': { fr: 'Nous traiterons votre signalement dans les plus brefs délais. Vous recevrez une notification dès qu\'il sera pris en charge.', en: 'We will process your report as soon as possible. You will receive a notification once it is handled.' },

  // Incident Details
  'incident.details.title': { fr: 'Détails du signalement', en: 'Report Details' },
  'incident.details.loading': { fr: 'Chargement...', en: 'Loading...' },
  'incident.details.reportNumber': { fr: 'Signalement #{number}', en: 'Report #{number}' },
  'incident.details.status': { fr: 'Statut', en: 'Status' },
  'incident.details.priority': { fr: 'Priorité', en: 'Priority' },
  'incident.details.information': { fr: 'Informations du signalement', en: 'Report Information' },
  'incident.details.problemType': { fr: 'Type de problème', en: 'Problem Type' },
  'incident.details.relatedBike': { fr: 'Vélo concerné', en: 'Related Bike' },
  'incident.details.creationDate': { fr: 'Date de création', en: 'Creation Date' },
  'incident.details.resolvedDate': { fr: 'Résolu le', en: 'Resolved on' },
  'incident.details.photosCount': { fr: 'Photos jointes ({count})', en: 'Attached Photos ({count})' },
  'incident.details.refundIssued': { fr: 'Remboursement effectué', en: 'Refund Issued' },
  'incident.details.refundAmount': { fr: 'Montant : {amount} XOF', en: 'Amount: {amount} XOF' },
  'incident.details.refundDescription': { fr: 'Le montant a été crédité sur votre portefeuille', en: 'The amount has been credited to your wallet' },
  'incident.details.adminNote': { fr: 'Note de l\'administrateur', en: 'Administrator Note' },
  'incident.details.editReport': { fr: 'Modifier le signalement', en: 'Edit Report' },
  'incident.details.back': { fr: 'Retour', en: 'Back' },

  // Status Help Text
  'incident.statusHelp.open': { fr: 'Votre signalement sera traité dans les plus brefs délais. Vous recevrez une notification dès qu\'il sera pris en charge.', en: 'Your report will be processed as soon as possible. You will receive a notification once it is handled.' },
  'incident.statusHelp.inProgress': { fr: 'Votre signalement est actuellement en cours de traitement par notre équipe technique.', en: 'Your report is currently being processed by our technical team.' },
  'incident.statusHelp.resolved': { fr: 'Ce signalement a été traité. Merci pour votre contribution à l\'amélioration de notre service.', en: 'This report has been processed. Thank you for your contribution to improving our service.' },

  // Incident Types
  'incident.technical': { fr: 'Problème technique', en: 'Technical Issue' },
  'incident.accident': { fr: 'Accident', en: 'Accident' },
  'incident.brakes': { fr: 'Problème de freins', en: 'Brake problem' },
  'incident.battery': { fr: 'Problème de batterie', en: 'Battery problem' },
  'incident.tire': { fr: 'Problème de pneu', en: 'Tire problem' },
  'incident.chain': { fr: 'Problème de chaîne', en: 'Chain problem' },
  'incident.lights': { fr: 'Problème de lumières', en: 'Light problem' },
  'incident.lock': { fr: 'Problème de cadenas', en: 'Lock problem' },
  'incident.electronics': { fr: 'Problème électronique', en: 'Electronics problem' },
  'incident.physicalDamage': { fr: 'Dégât physique', en: 'Physical damage' },
  'incident.theft': { fr: 'Vol ou tentative', en: 'Theft or attempt' },
  'incident.damage': { fr: 'Dommage', en: 'Damage' },
  'incident.other': { fr: 'Autre problème', en: 'Other problem' },

  // Severity Messages
  'incident.severity.critical': { fr: 'Ce problème mettra le vélo en maintenance automatiquement', en: 'This problem will automatically put the bike in maintenance' },

  // QR Scanner
  'qr.title': { fr: 'Scanner le QR code', en: 'Scan QR Code' },
  'qr.scan': { fr: 'Scanner', en: 'Scan' },
  'qr.manual': { fr: 'Manuel', en: 'Manual' },
  'qr.scannerNotImplemented': { fr: 'Scanner QR non implémenté. Utilisez la saisie manuelle.', en: 'QR scanner not implemented. Use manual input.' },
  'qr.enterCode': { fr: 'Veuillez entrer le code du vélo', en: 'Please enter the bike code' },
  'qr.bikeFound': { fr: 'Vélo trouvé avec succès', en: 'Bike found successfully' },
  'qr.bikeUnavailable': { fr: 'Ce vélo n\'est pas disponible', en: 'This bike is not available' },
  'qr.invalidCode': { fr: 'Code invalide ou vélo introuvable', en: 'Invalid code or bike not found' },
  'qr.tapToScan': { fr: 'Appuyez pour scanner', en: 'Tap to scan' },
  'qr.instructions': { fr: 'Pointez la caméra vers le QR code sur le vélo', en: 'Point the camera at the QR code on the bike' },
  'qr.scanning': { fr: 'Scan en cours...', en: 'Scanning...' },
  'qr.startScanning': { fr: 'Commencer le scan', en: 'Start scanning' },
  'qr.stopScanning': { fr: 'Arrêter le scan', en: 'Stop scanning' },
  'qr.cameraPermissionDenied': { fr: 'Permission caméra refusée. Activez-la dans les paramètres.', en: 'Camera permission denied. Enable it in settings.' },
  'qr.bikeCode': { fr: 'Code du vélo', en: 'Bike Code' },
  'qr.howToFind': { fr: 'Comment trouver le code ?', en: 'How to find the code?' },
  'qr.findSticker': { fr: 'Le code se trouve sur l\'autocollant apposé sur le vélo', en: 'The code is on the sticker attached to the bike' },
  'qr.manualInput': { fr: 'Saisir le code manuellement', en: 'Enter Code Manually' },
  'qr.scanSuccess': { fr: 'QR Code scanné !', en: 'QR Code scanned!' },
  
  // Bike Inspection
  'inspection.title.pickup': { fr: 'Inspection avant prise', en: 'Pre-pickup Inspection' },
  'inspection.title.return': { fr: 'Inspection avant retour', en: 'Pre-return Inspection' },
  'inspection.description.pickup': { fr: 'Vérifiez l\'état du vélo avant de commencer votre trajet', en: 'Check bike condition before starting your ride' },
  'inspection.description.return': { fr: 'Vérifiez l\'état du vélo avant de le retourner', en: 'Check bike condition before returning it' },
  'inspection.required': { fr: 'obligatoire', en: 'required' },
  'inspection.essentialItems': { fr: 'Éléments essentiels', en: 'Essential items' },
  'inspection.nonEssentialItems': { fr: 'Éléments non essentiels', en: 'Non-essential items' },
  'inspection.complete': { fr: 'Complet', en: 'Complete' },
  'inspection.optional': { fr: 'Optionnel', en: 'Optional' },
  'inspection.essentials': { fr: 'Essentiels', en: 'Essentials' },
  'inspection.optionals': { fr: 'Optionnels', en: 'Optionals' },
  'inspection.criticalIssues': { fr: 'Problèmes critiques détectés *', en: 'Critical issues detected *' },
  'inspection.minorIssues': { fr: 'Problèmes mineurs détectés', en: 'Minor issues detected' },
  'inspection.notesPlaceholderCritical': { fr: 'Description des problèmes critiques (obligatoire)', en: 'Description of critical issues (required)' },
  'inspection.notesPlaceholderRecommended': { fr: 'Description des problèmes (recommandé)', en: 'Description of issues (recommended)' },
  'inspection.notesPlaceholderOptional': { fr: 'Ajoutez des notes (optionnel)', en: 'Add notes (optional)' },
  'inspection.notesRequiredForCritical': { fr: 'Une description est requise pour les problèmes critiques', en: 'A description is required for critical issues' },
  'inspection.thanksForFeedback': { fr: 'Merci pour votre retour détaillé', en: 'Thank you for your detailed feedback' },
  'inspection.photosRequiredCritical': { fr: 'Des photos sont nécessaires pour documenter les problèmes critiques', en: 'Photos are required to document critical issues' },
  'inspection.photosRecommended': { fr: 'Ajoutez des photos des problèmes identifiés', en: 'Add photos of identified issues' },
  'inspection.photosOptional': { fr: 'Photos optionnelles pour documenter l\'état du vélo', en: 'Optional photos to document bike condition' },
  'inspection.supportedFormats': { fr: 'Formats supportés : JPEG, PNG, GIF, WebP', en: 'Supported formats: JPEG, PNG, GIF, WebP' },
  'inspection.maxSize': { fr: 'Max 5 Mo', en: 'Max 5 MB' },
  'inspection.camera': { fr: 'Appareil photo', en: 'Camera' },
  'inspection.gallery': { fr: 'Galerie', en: 'Gallery' },
  'inspection.photoSource': { fr: 'Choisissez une option', en: 'Choose an option' },
  'inspection.invalidImageFormat': { fr: 'Seuls les fichiers images sont autorisés (JPEG, PNG, GIF, WebP)', en: 'Only image files are allowed (JPEG, PNG, GIF, WebP)' },
  'inspection.imageTooLarge': { fr: 'La taille de l\'image ne doit pas dépasser 5 Mo', en: 'Image size must not exceed 5 MB' },
  'inspection.cameraPermissionDenied': { fr: 'Permission caméra requise', en: 'Camera permission required' },
  'inspection.galleryPermissionDenied': { fr: 'Permission galerie requise', en: 'Gallery permission required' },
  'inspection.description.pickupDetail': { fr: 'Notez les éventuels problèmes pour documenter l\'état du vélo.', en: 'Note any issues to document the bike\'s condition.' },
  'inspection.description.returnDetail': { fr: 'Documentez l\'état du vélo au moment du retour.', en: 'Document the bike\'s condition at return time.' },
  'inspection.notesRequiredForIssues': { fr: 'Des notes sont requises pour documenter les problèmes', en: 'Notes are required to document issues' },
  'inspection.unlockRequestDisclaimer': { fr: 'En validant, vous envoyez une demande de déverrouillage qui sera examinée par un administrateur.', en: 'By confirming, you\'re sending an unlock request that will be reviewed by an administrator.' },
  'inspection.returnDisclaimer': { fr: 'En validant, vous confirmez le retour du vélo.', en: 'By confirming, you confirm the bike return.' },
  'common.sending': { fr: 'Envoi en cours...', en: 'Sending...' },
  'inspection.checkItems': { fr: 'Éléments à vérifier', en: 'Items to Check' },
  'inspection.progress': { fr: 'Progression', en: 'Progress' },
  'inspection.issues': { fr: 'Problèmes identifiés', en: 'Issues Identified' },
  'inspection.notes': { fr: 'Notes', en: 'Notes' },
  'inspection.notesRequired': { fr: 'Des notes sont requises lorsque des problèmes sont identifiés', en: 'Notes required when issues are identified' },
  'inspection.notesPlaceholder': { fr: 'Décrivez les problèmes identifiés en détail...', en: 'Describe the identified issues in detail...' },
  'inspection.optionalNotes': { fr: 'Ajoutez des notes (optionnel)', en: 'Add notes (optional)' },
  'inspection.photos': { fr: 'Photos', en: 'Photos' },
  'inspection.recommended': { fr: 'recommandé', en: 'recommended' },
  'inspection.addPhoto': { fr: 'Ajouter une photo', en: 'Add Photo' },
  'inspection.maxPhotos': { fr: 'Maximum 5 photos', en: 'Maximum 5 photos' },
  'inspection.photoPermissionDenied': { fr: 'Permission d\'accéder à la galerie refusée', en: 'Gallery access permission denied' },
  'inspection.photoError': { fr: 'Erreur lors de la sélection de l\'image', en: 'Error selecting image' },
  'inspection.completeAllItems': { fr: 'Veuillez inspecter tous les éléments', en: 'Please inspect all items' },
  'inspection.pickupAction': { fr: 'Commencer le trajet', en: 'Start Ride' },
  'inspection.returnAction': { fr: 'Retourner le vélo', en: 'Return Bike' },
  'inspection.sendUnlockRequest': { fr: 'Envoyer la demande de déverrouillage', en: 'Send Unlock Request' },
  'inspection.confirmPickup': { fr: 'En confirmant, vous déclarez avoir vérifié l\'état du vélo', en: 'By confirming, you declare that you have checked the bike condition' },
  'inspection.confirmReturn': { fr: 'En confirmant, vous déclarez retourner le vélo dans l\'état indiqué', en: 'By confirming, you declare that you are returning the bike in the indicated condition' },
  'inspection.brakes': { fr: 'Freins', en: 'Brakes' },
  'inspection.tires': { fr: 'Pneus', en: 'Tires' },
  'inspection.battery': { fr: 'Batterie', en: 'Battery' },
  'inspection.chain': { fr: 'Chaîne', en: 'Chain' },
  'inspection.seat': { fr: 'Selle', en: 'Seat' },
  'inspection.handlebars': { fr: 'Guidon', en: 'Handlebars' },
  'inspection.frame': { fr: 'Cadre', en: 'Frame' },
  'inspection.allOk': { fr: 'Tout OK', en: 'All OK' },
  'inspection.allNotOk': { fr: 'Tout Mauvais', en: 'All Bad' },
  'inspection.sliderInstruction': { fr: 'Faites glisser chaque barre pour indiquer l\'état (0% = hors service, 100% = parfait)', en: 'Slide each bar to indicate condition (0% = out of service, 100% = perfect)' },
  'inspection.issuesCount': { fr: '{count} élément(s) en mauvais état', en: '{count} item(s) in poor condition' },
  'inspection.condition.bad': { fr: 'Mauvais', en: 'Bad' },
  'inspection.condition.degraded': { fr: 'Dégradé', en: 'Degraded' },
  'inspection.condition.good': { fr: 'Bon', en: 'Good' },
  
  // Incident statuses
  'incident.status.open': { fr: 'Ouvert', en: 'Open' },
  'incident.status.in_progress': { fr: 'En cours', en: 'In Progress' },
  'incident.status.resolved': { fr: 'Résolu', en: 'Resolved' },
  'incident.status.closed': { fr: 'Fermé', en: 'Closed' },
  'incident.adminNote': { fr: 'Note administrative', en: 'Admin Note' },
  'incident.updated': { fr: 'Signalement mis à jour', en: 'Report updated' },
  'incident.deleted': { fr: 'Signalement supprimé', en: 'Report deleted' },

  // Reservation Page
  'reservation.planSelection': { fr: 'Plan Tarifaire *', en: 'Pricing Plan *' },
  'reservation.packageType': { fr: 'Type de Forfait *', en: 'Package Type *' },
  'reservation.startDate': { fr: 'Date de début *', en: 'Start Date *' },
  'reservation.startTime': { fr: 'Heure de début *', en: 'Start Time *' },
  'reservation.selectDate': { fr: 'Sélectionner une date', en: 'Select a date' },
  'reservation.selectTime': { fr: 'Sélectionner l\'heure', en: 'Select time' },
  'reservation.conflictMessage': { fr: 'Une réservation existe déjà pour cette période', en: 'A reservation already exists for this period' },
  'reservation.summary': { fr: 'Résumé de la réservation', en: 'Reservation Summary' },
  'reservation.dateTime': { fr: 'Date/Heure :', en: 'Date/Time:' },
  'reservation.coverage': { fr: 'Couverture :', en: 'Coverage:' },
  'reservation.price': { fr: 'Prix :', en: 'Price:' },
  'reservation.free': { fr: 'Gratuit', en: 'Free' },
  'reservation.additional': { fr: 'supplémentaire', en: 'additional' },
  'reservation.confirm': { fr: 'Confirmer la réservation', en: 'Confirm Reservation' },
  'reservation.creating': { fr: 'Création...', en: 'Creating...' },
  'reservation.fillAllFields': { fr: 'Veuillez remplir tous les champs', en: 'Please fill all fields' },
  'reservation.reserveBike': { fr: 'Réserver ce vélo', en: 'Reserve this bike' },
  'reservation.title': { fr: 'Réservation', en: 'Reservation' },

  // Report/Incident
  'report.title': { fr: 'Mes signalements', en: 'My Reports' },
  'report.createNew': { fr: 'Nouveau signalement', en: 'New Report' },
  'report.edit': { fr: 'Modifier le signalement', en: 'Edit Report' },
  'report.details': { fr: 'Détails du signalement', en: 'Report Details' },
  'report.noReports': { fr: 'Aucun signalement', en: 'No Reports' },
  'report.noReportsDescription': { fr: 'Vous n\'avez effectué aucun signalement pour le moment', en: 'You haven\'t made any reports yet' },
  'report.type': { fr: 'Type de problème', en: 'Problem Type' },
  'report.selectType': { fr: 'Sélectionner le type de problème', en: 'Select problem type' },
  'report.detailedDescription': { fr: 'Description détaillée', en: 'Detailed Description' },
  'report.descriptionPlaceholder': { fr: 'Décrivez le problème en détail...', en: 'Describe the problem in detail...' },
  'report.photos': { fr: 'Photos (optionnel)', en: 'Photos (optional)' },
  'report.photosDescription': { fr: 'Ajoutez jusqu\'à 5 photos pour illustrer le problème', en: 'Add up to 5 photos to illustrate the problem' },
  'report.photoNumber': { fr: 'Photo {number}', en: 'Photo {number}' },
  'report.addPhoto': { fr: 'Ajouter une photo', en: 'Add Photo' },
  'report.submit': { fr: 'Envoyer le signalement', en: 'Send Report' },
  'report.success': { fr: 'Signalement envoyé avec succès', en: 'Report submitted successfully' },
  'report.fillRequired': { fr: 'Veuillez remplir tous les champs requis', en: 'Please fill in all required fields' },
  'report.minLength': { fr: 'Description trop courte (minimum 20 caractères)', en: 'Description too short (minimum 20 characters)' },
  'report.characterCount': { fr: 'Minimum {min} caractères ({current}/{min})', en: 'Minimum {min} characters ({current}/{min})' },
  'report.maxPhotos': { fr: 'Maximum 5 photos', en: 'Maximum 5 photos' },
  'report.photoPermissionDenied': { fr: 'Permission d\'accéder à la galerie refusée', en: 'Gallery access permission denied' },
  'report.photoError': { fr: 'Erreur lors de la sélection de l\'image', en: 'Error selecting image' },
  'report.processingNotice': { fr: 'Nous traiterons votre signalement dans les plus brefs délais', en: 'We will process your report as soon as possible' },
  'report.infoDescription': { fr: 'Décrivez le problème rencontré avec ce vélo. Votre signalement nous aidera à améliorer la qualité du service.', en: 'Describe the problem encountered with this bike. Your report will help us improve service quality.' },
  'report.createdAt': { fr: 'Créé le', en: 'Created on' },
  'report.description': { fr: 'Description', en: 'Description' },

  // Chat
  'chat.title': { fr: 'Chat Support', en: 'Support Chat' },
  'chat.support': { fr: 'Support FreeBike', en: 'FreeBike Support' },
  'chat.online': { fr: 'En ligne', en: 'Online' },
  'chat.offline': { fr: 'Hors ligne', en: 'Offline' },
  'chat.typing': { fr: 'En train d\'écrire...', en: 'Typing...' },
  'chat.messagePlaceholder': { fr: 'Écrire un message...', en: 'Write a message...' },
  'chat.secureNotice': { fr: 'Cette conversation est sécurisée et privée', en: 'This conversation is secure and private' },
  'chat.averageResponse': { fr: 'Temps de réponse moyen : 5 minutes', en: 'Average response time: 5 minutes' },
  'chat.information': { fr: 'Informations', en: 'Information' },
  'chat.you': { fr: 'Vous', en: 'You' },
  'chat.justNow': { fr: 'À l\'instant', en: 'Just now' },
  'chat.autoResponse': { fr: 'Merci pour votre message. Un membre de notre équipe vous répondra dans les plus brefs délais.', en: 'Thank you for your message. A member of our team will respond to you as soon as possible.' },
  
  // Chat support info
  'chat.supportInfo.description': { fr: 'Informations sur le support', en: 'Support Information' },
  'chat.supportInfo.service': { fr: 'Service', en: 'Service' },
  'chat.supportInfo.status': { fr: 'Statut', en: 'Status' },
  'chat.supportInfo.responseTime': { fr: 'Temps de réponse', en: 'Response Time' },
  'chat.supportInfo.responseTimeValue': { fr: '~5 minutes', en: '~5 minutes' },
  'chat.supportInfo.availability': { fr: 'Disponibilité', en: 'Availability' },
  'chat.supportInfo.availabilityValue': { fr: 'Lun-Dim 7h-22h', en: 'Mon-Sun 7am-10pm' },

  // Internet & Network
  'common.networkError': { fr: 'Erreur de réseau', en: 'Network error' },
  'common.networkRestored': { fr: 'Connexion Internet rétablie', en: 'Internet connection restored' },
  'auth.internetRequired': { fr: 'Veuillez vous connecter à Internet pour effectuer cette action', en: 'Please connect to the internet to perform this action' },
  'auth.internetRequiredForLogin': { fr: 'Veuillez vous connecter à Internet pour vous authentifier', en: 'Please connect to the internet to authenticate' },
  'auth.internetRequiredForRegister': { fr: 'Veuillez vous connecter à Internet pour vous inscrire', en: 'Please connect to the internet to register' },
  'auth.internetRequiredForUser': { fr: 'Veuillez vous connecter à Internet pour récupérer vos informations', en: 'Please connect to the internet to retrieve your information' },
  'auth.internetRequiredForForgotPassword': { fr: 'Veuillez vous connecter à Internet pour réinitialiser votre mot de passe', en: 'Please connect to the internet to reset your password' },
  'auth.internetRequiredForResetPassword': { fr: 'Veuillez vous connecter à Internet pour réinitialiser votre mot de passe', en: 'Please connect to the internet to reset your password' },
  'auth.internetRequiredForChangePassword': { fr: 'Veuillez vous connecter à Internet pour changer votre mot de passe', en: 'Please connect to the internet to change your password' },
  
  // Common
  'common.change': { fr: 'Modifier', en: 'Change' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },
  'common.confirm': { fr: 'Confirmer', en: 'Confirm' },
  'common.ok': { fr: 'Oui', en: 'Yes' },
  'common.save': { fr: 'Enregistrer', en: 'Save' },
  'common.close': { fr: 'Fermer', en: 'Close' },
  'common.back': { fr: 'Retour', en: 'Back' },
  'common.next': { fr: 'Suivant', en: 'Next' },
  'common.loading': { fr: 'Chargement...', en: 'Loading...' },
  'common.error': { fr: 'Erreur', en: 'Error' },
  'common.success': { fr: 'Succès', en: 'Success' },
  'common.search': { fr: 'Rechercher', en: 'Search' },
  'common.reset': { fr: 'Réinitialiser', en: 'Reset' },
  'common.apply': { fr: 'Appliquer', en: 'Apply' },
  'common.required': { fr: 'Ce champ est requis', en: 'This field is required' },
  'common.retry': { fr: 'Réessayer', en: 'Retry' },
  'common.checking': { fr: 'Vérification...', en: 'Checking...' },
  'common.loadingBikes': { fr: 'Chargement des vélos disponibles...', en: 'Loading available bikes...' },
  'common.photo': { fr: 'Photo {number}', en: 'Photo {number}' },
  'common.minutes': { fr: 'minutes', en: 'minutes' },
  'common.verified': { fr: 'Vérifié', en: 'Verified' },
  'common.notVerified': { fr: 'Non vérifié', en: 'Not verified' },
  'common.priceWithCurrency': { fr: '{price} FCFA', en: '{price} FCFA' },

  // Formats de date
  'date.timeFormat': { fr: 'HH:mm', en: 'hh:mm a' },
  'date.dateFormat': { fr: 'dd/MM/yyyy', en: 'MM/dd/yyyy' },

  // Phone Verification
  'auth.phone.enterPhone': { fr: 'Entrez votre numéro de téléphone', en: 'Enter your phone number' },
  'auth.phone.enterPhoneDescription': { fr: 'Nous vous enverrons un code de vérification par SMS', en: 'We will send you a verification code via SMS' },
  'auth.phone.phoneNumber': { fr: 'Numéro de téléphone', en: 'Phone number' },
  'auth.phone.phonePlaceholder': { fr: '+237 6XX XXX XXX', en: '+237 6XX XXX XXX' },
  'auth.phone.sendCode': { fr: 'Envoyer le code', en: 'Send code' },
  'auth.phone.enterCode': { fr: 'Entrez le code de vérification', en: 'Enter verification code' },
  'auth.phone.enterCodeDescription': { fr: 'Nous avons envoyé un code à {phone}', en: 'We sent a code to {phone}' },
  'auth.phone.verificationCode': { fr: 'Code de vérification', en: 'Verification code' },
  'auth.phone.devCode': { fr: 'Code de développement', en: 'Development code' },
  'auth.phone.verify': { fr: 'Vérifier', en: 'Verify' },
  'auth.phone.verified': { fr: 'Téléphone vérifié avec succès', en: 'Phone verified successfully' },
  'auth.phone.codeSent': { fr: 'Code envoyé avec succès', en: 'Code sent successfully' },
  'auth.phone.invalidCode': { fr: 'Code invalide ou expiré', en: 'Invalid or expired code' },
  'auth.phone.didntReceive': { fr: 'Vous n\'avez pas reçu le code ?', en: 'Didn\'t receive the code?' },
  'auth.phone.resend': { fr: 'Renvoyer le code', en: 'Resend code' },
  'auth.phone.resendIn': { fr: 'Renvoyer dans', en: 'Resend in' },
  'auth.phone.changePhone': { fr: 'Changer le numéro', en: 'Change number' },
  'auth.phone.verifyNow': { fr: 'Vérifier maintenant', en: 'Verify now' },

  // Document Submission
  'document.submission': {fr: 'Soumission de documents', en: 'Document submission'},
  'document.identityDocument': { fr: 'Pièce d\'identité', en: 'Identity document' },
  'document.residenceProof': { fr: 'Preuve de résidence', en: 'Residence proof' },
  'document.documentType': { fr: 'Type de document', en: 'Document type' },
  'document.cni': { fr: 'CNI (Carte Nationale d\'Identité)', en: 'National ID Card' },
  'document.recepisse': { fr: 'Récépissé', en: 'Receipt' },
  'document.frontImage': { fr: 'Image recto', en: 'Front image' },
  'document.backImage': { fr: 'Image verso', en: 'Back image' },
  'document.takeOrSelectPhoto': { fr: 'Prendre ou sélectionner une photo', en: 'Take or select photo' },
  'document.submit': { fr: 'Soumettre', en: 'Submit' },
  'document.submitted': { fr: 'Document soumis avec succès', en: 'Document submitted successfully' },
  'document.submissionFailed': { fr: 'Échec de la soumission du document', en: 'Document submission failed' },
  'document.approved': { fr: 'Approuvé', en: 'Approved' },
  'document.rejected': { fr: 'Rejeté', en: 'Rejected' },
  'document.pending': { fr: 'En attente', en: 'Pending' },
  'document.allApproved': { fr: 'Tous les documents sont approuvés', en: 'All documents are approved' },
  'document.waitingAdminValidation': { fr: 'En attente de validation par l\'administrateur', en: 'Waiting for administrator validation' },
  'document.allSubmitted': { fr: 'Tous les documents ont été soumis', en: 'All documents have been submitted' },
  'document.waitingAdminReview': { fr: 'En attente d\'examen par l\'administrateur', en: 'Waiting for administrator review' },
  'document.rejectionReason': { fr: 'Raison du rejet', en: 'Rejection reason' },
  'document.proofType': { fr: 'Type de preuve', en: 'Proof type' },
  'document.document': { fr: 'Document', en: 'Document' },
  'document.mapCoordinates': { fr: 'Coordonnées de la carte', en: 'Map coordinates' },
  'document.residenceDocument': { fr: 'Document de résidence', en: 'Residence document' },
  'document.residenceLocation': { fr: 'Localisation de résidence', en: 'Residence location' },
  'document.getCurrentLocation': { fr: 'Obtenir la localisation actuelle', en: 'Get current location' },
  'document.address': { fr: 'Adresse', en: 'Address' },
  'document.addressPlaceholder': { fr: 'Entrez votre adresse complète', en: 'Enter your full address' },
  'document.details': { fr: 'Détails', en: 'Details' },
  'document.detailsPlaceholder': { fr: 'Ajoutez des détails sur votre résidence', en: 'Add details about your residence' },
  'document.residenceDocumentRequired': { fr: 'Le document de résidence est requis', en: 'Residence document is required' },
  'document.residenceLocationRequired': { fr: 'La localisation de résidence est requise', en: 'Residence location is required' },
  'document.frontImageRequired': { fr: 'L\'image recto est requise', en: 'Front image is required' },
  'document.cameraPermissionDenied': { fr: 'Permission de la caméra refusée', en: 'Camera permission denied' },
  'document.imageError': { fr: 'Erreur lors de la sélection de l\'image', en: 'Error selecting image' },
  'document.selectImageSource': { fr: 'Sélectionner la source de l\'image', en: 'Select image source' },
  'document.takePhoto': { fr: 'Prendre une photo', en: 'Take photo' },
  'document.chooseFromGallery': { fr: 'Choisir depuis la galerie', en: 'Choose from gallery' },
  'document.locationPermissionDenied': { fr: 'Permission de localisation refusée', en: 'Location permission denied' },
  'document.locationError': { fr: 'Erreur lors de l\'obtention de la localisation', en: 'Error getting location' },
  'document.alreadyApproved': { fr: 'Déjà approuvé', en: 'Already approved' },
  'document.waitingForReview': { fr: 'En attente d\'examen', en: 'Waiting for review' },
  'document.selfie': { fr: 'Selfie (photo/vidéo)', en: 'Selfie (photo/video)' },
  'document.takeSelfie': { fr: 'Prendre un selfie ou filmer', en: 'Take a selfie or record video' },
  'document.selectMediaSource': { fr: 'Sélectionner la source du média', en: 'Select media source' },
  'document.recordVideo': { fr: 'Filmer une vidéo', en: 'Record video' },
  'document.videoError': { fr: 'Erreur lors de l\'enregistrement de la vidéo', en: 'Error recording video' },
  'document.activityLocationProof': { fr: 'Preuve de localisation d\'activité', en: 'Activity location proof' },
  'document.activityDocument': { fr: 'Document d\'activité', en: 'Activity document' },
  'document.activityLocation': { fr: 'Localisation d\'activité', en: 'Activity location' },
  'document.activityDocumentRequired': { fr: 'Le document d\'activité est requis', en: 'Activity document is required' },
  'document.activityLocationRequired': { fr: 'La localisation d\'activité est requise', en: 'Activity location is required' },
  'document.activityLocationProofDesc': { fr: 'Lieu de travail, établissement secondaire ou universitaire (pour les élèves/étudiants et autres)', en: 'Workplace, secondary or university establishment (for students and others)' },
  'document.videoSelected': { fr: 'Vidéo sélectionnée', en: 'Video selected' },

  // Common additions
  'common.skipForNow': { fr: 'Passer pour l\'instant', en: 'Skip for now' },
  'common.later': { fr: 'Plus tard', en: 'Later' },
  'common.optional': { fr: 'Optionnel', en: 'Optional' },
  'validation.invalidCode': { fr: 'Code invalide', en: 'Invalid code' },

  // Account Management
  'account.inspectionReport': { fr: 'Rapport d\'inspection', en: 'Inspection Report' },
  'account.condition': { fr: 'État', en: 'Condition' },
  'account.reportedIssues': { fr: 'Problèmes signalés', en: 'Reported Issues' },
  'account.notes': { fr: 'Notes', en: 'Notes' },
  'account.adminNote': { fr: 'Note administrative', en: 'Admin Note' },
  'account.rejectionReason': { fr: 'Raison du rejet', en: 'Rejection Reason' },
  'account.inProgress': { fr: 'En cours', en: 'In Progress' },
  'account.upcoming': { fr: 'À venir', en: 'Upcoming' },
  'account.unknown': { fr: 'Inconnue', en: 'Unknown' },
  'account.cannotDelete': { fr: 'Suppression impossible', en: 'Cannot Delete' },
  'account.cannotDeleteMessage': { fr: 'Seules les demandes en attente peuvent être supprimées.', en: 'Only pending requests can be deleted.' },
  'account.cannotCancel': { fr: 'Annulation impossible', en: 'Cannot Cancel' },
  'account.cannotCancelMessage': { fr: 'Seules les réservations actives peuvent être annulées.', en: 'Only active reservations can be cancelled.' },
  
  // Incident translations
  'incident.adminCharge': { fr: 'Charge administrative', en: 'Administrative charge' },
  'incident.reason.damage': { fr: 'Dommage au vélo', en: 'Bike damage' },
  'incident.reason.theft': { fr: 'Vol ou perte', en: 'Theft or loss' },
  'incident.reason.lateReturn': { fr: 'Retour tardif', en: 'Late return' },
  'incident.reason.cleaning': { fr: 'Nettoyage requis', en: 'Cleaning required' },
  'incident.reason.repair': { fr: 'Réparation nécessaire', en: 'Repair needed' },
  'incident.reason.accessoryLoss': { fr: 'Perte d\'accessoire', en: 'Accessory loss' },
  'incident.reason.other': { fr: 'Autre', en: 'Other' },
  
  // Account Management
  'accountManagement.chargeAmount': { fr: 'Charge: {amount} FCFA', en: 'Charge: {amount} FCFA' },
  'accountManagement.assignedBy': { fr: 'Assigné par', en: 'Assigned by' },

  // App Info & OTA Updates
  'appInfo.about': { fr: 'À propos', en: 'About' },
  'appInfo.appVersion': { fr: 'Version de l\'app', en: 'App version' },
  'appInfo.updateChannel': { fr: 'Canal de mise à jour', en: 'Update channel' },
  'appInfo.activeUpdateId': { fr: 'ID de la mise à jour active', en: 'Active update ID' },
  'appInfo.installedOn': { fr: 'Installée le', en: 'Installed on' },
  'appInfo.otaUpdates': { fr: 'Mises à jour OTA', en: 'OTA updates' },
  'appInfo.enabled': { fr: 'Activées', en: 'Enabled' },
  'appInfo.devMode': { fr: 'Dev mode', en: 'Dev mode' },
  'appInfo.notConfigured': { fr: 'Non configuré', en: 'Not configured' },
  'appInfo.nativeBuild': { fr: 'Version native', en: 'Native build' },
  'appInfo.unknown': { fr: 'Inconnue', en: 'Unknown' },
  'appInfo.updates': { fr: 'Mises à jour', en: 'Updates' },
  'appInfo.checkPrompt': { fr: 'Appuyez sur le bouton pour vérifier.', en: 'Tap the button to check.' },
  'appInfo.checking': { fr: 'Vérification en cours…', en: 'Checking for updates…' },
  'appInfo.upToDate': { fr: 'L\'application est à jour.', en: 'The app is up to date.' },
  'appInfo.available': { fr: 'Une mise à jour est disponible.', en: 'An update is available.' },
  'appInfo.availableDesc': { fr: 'La mise à jour est rapide et ne supprime pas vos données.', en: 'The update is quick and does not delete your data.' },
  'appInfo.downloading': { fr: 'Téléchargement et installation…', en: 'Downloading and installing…' },
  'appInfo.installUpdate': { fr: 'Installer la mise à jour', en: 'Install update' },
  'appInfo.checkUpdates': { fr: 'Vérifier les mises à jour', en: 'Check for updates' },
  'appInfo.reset': { fr: 'Réinitialiser', en: 'Reset' },
  'appInfo.devModeNotice': { fr: 'Mises à jour non disponibles en mode développement', en: 'Updates not available in development mode' },
  'appInfo.checkError': { fr: 'Impossible de vérifier les mises à jour.', en: 'Unable to check for updates.' },
  'appInfo.downloadError': { fr: 'Le téléchargement a échoué. Veuillez réessayer.', en: 'Download failed. Please try again.' },
  'appInfo.copyright': { fr: '© {year} Xybronix · FreeBike', en: '© {year} Xybronix · FreeBike' },

  // Mandatory OTA update screen
  'update.mandatory.title': { fr: 'Mise à jour requise', en: 'Update required' },
  'update.mandatory.description': { fr: 'Une nouvelle version de l\'application est disponible. Vous devez mettre à jour pour continuer à utiliser l\'application.', en: 'A new version of the app is available. You must update to continue using the app.' },
  'update.mandatory.dataNotice': { fr: 'La mise à jour est rapide et ne supprime pas vos données.', en: 'The update is quick and does not delete your data.' },
  'update.mandatory.button': { fr: 'Mettre à jour maintenant', en: 'Update now' },
  'update.mandatory.downloading': { fr: 'Téléchargement en cours…', en: 'Downloading…' },
  'update.mandatory.installing': { fr: 'Installation en cours…', en: 'Installing…' },
  'update.mandatory.error': { fr: 'La mise à jour a échoué. Veuillez réessayer.', en: 'Update failed. Please try again.' },
  'update.mandatory.retry': { fr: 'Réessayer', en: 'Retry' },

  // Document modification
  'document.modify': { fr: 'Modifier', en: 'Modify' },
  'document.modifyWarning': { fr: 'Votre document sera soumis à une nouvelle vérification.', en: 'Your document will be submitted for re-verification.' },

  // Active Plan Banner
  'banner.tapToView': { fr: 'Appuyez pour voir', en: 'Tap to view' },
  'banner.durationRemaining': { fr: '{duration} restantes · exp. {date}', en: '{duration} remaining · exp. {date}' },
  'banner.expired': { fr: 'Expiré', en: 'Expired' },
  'banner.expiresTomorrow': { fr: 'Expire demain', en: 'Expires tomorrow' },
  'banner.daysRemaining': { fr: '{days} jours restants · {date}', en: '{days} days remaining · {date}' },
  'banner.freeDay': { fr: 'Jour gratuit', en: 'Free day' },
  'banner.freeDayRemaining': { fr: '{days} jour restant · exp. {date}', en: '{days} day remaining · exp. {date}' },
  'banner.freeDaysRemaining': { fr: '{days} jours restants · exp. {date}', en: '{days} days remaining · exp. {date}' },

  // Map provider toggle
  'map.switchToGoogle': { fr: 'Google Maps', en: 'Google Maps' },
  'map.switchToOSM': { fr: 'Carte OSM', en: 'OSM Map' },

  // Biometric Lock Screen
  'biometricLock.title': { fr: 'Application verrouillée', en: 'App Locked' },
  'biometricLock.subtitle': { fr: 'Déverrouillez pour continuer', en: 'Unlock to continue' },
  'biometricLock.unlockButton': { fr: 'Déverrouiller', en: 'Unlock' },
  'biometricLock.prompt': { fr: 'Déverrouillez pour accéder à l\'application', en: 'Unlock to access the app' },
  'biometricLock.lockSetting': { fr: 'Verrouillage à la fermeture', en: 'Lock on close' },
  'biometricLock.lockSettingDesc': { fr: 'Verrouille l\'app à chaque mise en arrière-plan', en: 'Locks the app when put in background' },

  // Inspection star rating
  'inspection.starInstruction': { fr: 'Évaluez chaque élément (1 étoile = hors service, 5 étoiles = parfait)', en: 'Rate each item (1 star = out of service, 5 stars = perfect)' },
};

interface MobileI18nContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: {
    (key: string): string;
    (key: string, params: Record<string, string | number>): string;
  };
  isLoading: boolean;
}

const STORAGE_KEY = 'EcoMobile_mobile_language';

// Export des traductions pour utilisation en dehors des composants React
export { translations };

// Fonction utilitaire pour obtenir une traduction sans contexte React
// Utile pour les fichiers de configuration et utilitaires
export const getTranslation = async (key: string, params?: Record<string, string | number>): Promise<string> => {
  try {
    const savedLanguage = await storage.getItem(STORAGE_KEY);
    const language: Language = (savedLanguage === 'fr' || savedLanguage === 'en') ? savedLanguage as Language : 'fr';
    
    let translation = translations[key]?.[language] || key;
    
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value.toString());
      });
    }
    
    return translation;
  } catch (error) {
    console.error('Error getting translation:', error);
    // Fallback en français en cas d'erreur
    return translations[key]?.fr || key;
  }
};

// Fonction synchrone avec langue par défaut (pour les cas où on ne peut pas attendre)
export const getTranslationSync = (key: string, language: Language = 'fr', params?: Record<string, string | number>): string => {
  let translation = translations[key]?.[language] || key;
  
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      translation = translation.replace(`{${param}}`, value.toString());
    });
  }
  
  return translation;
};

const MobileI18nContext = createContext<MobileI18nContextType | undefined>(undefined);

export function MobileI18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await storage.getItem(STORAGE_KEY);
      if (savedLanguage && (savedLanguage === 'fr' || savedLanguage === 'en')) {
        setLanguageState(savedLanguage as Language);
      }
    } catch (error) {
      console.error('Error loading saved language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      await storage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t: MobileI18nContextType['t'] = (key: string, params?: Record<string, string | number>): string => {
    let translation = translations[key]?.[language] || key;
    
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(`{${param}}`, value.toString());
      });
    }
    
    return translation;
  };

  return (
    <MobileI18nContext.Provider 
      value={{ 
        language, 
        setLanguage, 
        t, 
        isLoading 
      }}
    >
      {children}
    </MobileI18nContext.Provider>
  );
}

export function useMobileI18n() {
  const context = useContext(MobileI18nContext);
  if (context === undefined) {
    throw new Error('useMobileI18n must be used within a MobileI18nProvider');
  }
  return context;
}