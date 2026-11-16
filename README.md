# Klasora — Gestion scolaire (clone)

Application web 100 % statique : calcul des moyennes, classement, bulletins imprimables et suivi des résultats.
Aucun serveur ni compte requis : les données sont enregistrées dans le navigateur (localStorage).

## Fonctions
- Classes, élèves (ajout manuel ou import CSV), matières avec coefficients
- Saisie des notes (devoir 1, devoir 2, composition) par trimestre
- Moyennes par matière et générale, rang, mention, moyenne de classe
- Bulletins A4 imprimables (un élève ou toute la classe), trimestriels ou annuels
- Tableau de bord : moyenne par classe, taux de réussite, élèves en difficulté
- Sauvegarde / restauration au format JSON, données d'exemple

## Publier sur GitHub Pages
1. Créez un dépôt sur GitHub (par exemple `klasora`).
2. Envoyez-y tout le contenu de ce dossier (index.html, css/, js/, .nojekyll, README.md).
3. Dans le dépôt : Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/ (root)` → Save.
4. Après une minute, le site est disponible sur `https://VOTRE-NOM.github.io/klasora/`.

## Utiliser en local
Ouvrez simplement `index.html` dans un navigateur.

## Calcul
Moyenne d'une matière = (moyenne des devoirs × poids devoirs + composition × poids composition) ÷ (somme des poids).
Moyenne générale = Σ(moyenne × coefficient) ÷ Σ(coefficients des matières notées). Poids réglables dans Paramètres.
