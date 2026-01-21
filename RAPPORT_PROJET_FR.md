# Système de Simulation de Feux de Circulation - Rapport Technique

**Projet :** Simulation d'Intersection avec Feux de Circulation en Temps Réel  
**Auteur :** Yassine Frigui  
**Date :** Janvier 2026  
**Technologies :** React, Three.js, Python (aiohttp), WebSocket

---

## Résumé Exécutif

Ce projet implémente un système de simulation de feux de circulation en temps réel, comportant une interface de visualisation 3D frontend construite avec React et Three.js, connectée à un serveur WebSocket Python qui génère des modèles de trafic réalistes. Le système démontre des principes avancés d'ingénierie logicielle incluant une architecture modulaire, une communication bidirectionnelle en temps réel et des mesures de sécurité prêtes pour la production.

---

## Table des Matières

1. [Architecture du Système](#1-architecture-du-système)
2. [Implémentation du Backend](#2-implémentation-du-backend)
3. [Implémentation du Frontend](#3-implémentation-du-frontend)
4. [Protocole de Communication](#4-protocole-de-communication)
5. [Caractéristiques Techniques](#5-caractéristiques-techniques)
6. [Approche de Développement](#6-approche-de-développement)
7. [Stratégie de Déploiement](#7-stratégie-de-déploiement)

---

## 1. Architecture du Système

### 1.1 Architecture Globale

Le système suit une **architecture client-serveur** avec une séparation claire des responsabilités :

```
┌─────────────────────────────────────────┐
│       Frontend (React + Three.js)       │
│  • Visualisation 3D                     │
│  • Interface Utilisateur                │
│  • Physique des Véhicules               │
│  • Détection des Collisions             │
└──────────────┬──────────────────────────┘
               │ WebSocket (JSON)
               │ Bidirectionnel temps réel
┌──────────────▼──────────────────────────┐
│       Backend (Python aiohttp)          │
│  • Génération d'États du Trafic         │
│  • Contrôleur de Feux de Circulation    │
│  • Système d'Événements                 │
│  • Sécurité & Limitation de Débit       │
└─────────────────────────────────────────┘
```

### 1.2 Stack Technologique

**Frontend :**
- React 18 (framework UI)
- Three.js r160 (rendu 3D)
- Vite 5 (outil de build, serveur de développement)
- API WebSocket native

**Backend :**
- Python 3.12
- aiohttp 3.9 (serveur HTTP/WebSocket asynchrone)
- python-dotenv (configuration d'environnement)

**Déploiement :**
- Netlify (hébergement frontend)
- Render.com (hébergement backend)

---

## 2. Implémentation du Backend

### 2.1 Structure Modulaire

Le backend est organisé en trois modules distincts pour la maintenabilité et la testabilité :

#### **traffic.py** (Point d'Entrée Principal)
- Orchestre le démarrage de l'application
- Charge les variables d'environnement
- Initialise le simulateur et le serveur
- Gère l'arrêt gracieux

```python
# Responsabilités :
- Chargement de configuration (.env)
- Initialisation des composants
- Gestion des erreurs et configuration du logging
```

#### **traffic_simulation.py** (Logique Métier)
- **TrafficLightController** : Machine à états gérant les transitions des feux
  - Implémente des cycles VERT → JAUNE → ROUGE appropriés
  - Transitions synchronisées (paire N/S vs paire E/O)
  - Timing configurable (30s vert, 3s jaune)

- **TrafficSimulator** : Génère les états du trafic
  - Génération de véhicules basée sur le flux de trafic
  - Système d'événements (Heure de Pointe, Accidents, Météo)
  - Placement des véhicules basé sur la position

```python
# Logique de la machine à états :
VERT (30s) → JAUNE (3s) → ROUGE (33s)
    ↓                           ↓
La direction opposée passe au VERT
```

#### **server.py** (Couche Réseau)
- **WebSocketServer** : Gère toutes les opérations réseau
  - Gestion des connexions clients
  - Vérifications de sécurité (origine, limitation de débit, max clients)
  - Diffusion d'états (cycle de mise à jour 0,1s)
  - Points de terminaison de vérification de santé et métriques

### 2.2 Machine à États des Feux de Circulation

Le contrôleur de feux utilise une approche de **machine à états par paires** :

**Décision de Conception :**
- Les feux Nord/Sud fonctionnent comme une paire synchronisée
- Les feux Est/Ouest fonctionnent comme une paire synchronisée
- Une seule paire peut être au VERT à la fois
- La transition JAUNE assure la sécurité (tampon de 3 secondes)

**Implémentation :**
```python
def _check_transition(dir1, dir2, opp1, opp2):
    # dir1/dir2 : Paire actuelle (ex: N/S)
    # opp1/opp2 : Paire opposée (ex: E/O)
    
    if timer <= 0:
        if current == VERT:
            # Transition de sécurité
            changer en JAUNE (3 secondes)
        elif current == JAUNE:
            # Basculer vers la direction opposée
            paire actuelle → ROUGE
            paire opposée → VERT
```

### 2.3 Système d'Événements

La simulation inclut un système d'événements aléatoires pondérés :

**Événements :**
- Heure de Pointe (flux de trafic ×1,8)
- Accident (flux de trafic ×0,4)
- Mauvais Temps (flux de trafic ×0,6)
- Événement à Proximité (flux de trafic ×2,0)
- Construction (flux de trafic ×0,5)
- Aucun (trafic normal) - poids ×3

**Calcul du Flux :**
```python
flux_base = 10 véhicules/minute
flux_réel = flux_base × multiplicateur_événement × random(0.8, 1.2)
```

### 2.4 Génération de Véhicules

**Approche :**
- Générer 1-6 véhicules par direction par intervalle
- Positionner les véhicules en file avec espacement (8-15 unités)
- Le véhicule le plus proche est placé avant la ligne d'arrêt (position 35)
- Chaque véhicule reçoit un ID unique, une vitesse (8-15) et une voie

**Logique Spatiale :**
```
Ligne d'arrêt à la position 35
↓
Espacement des véhicules : 8-15 unités
Véhicule 1 : position 20
Véhicule 2 : position 8
Véhicule 3 : position -5
etc.
```

### 2.5 Implémentation de la Sécurité

**Validation d'Origine :**
```python
# Vérifie l'en-tête Origin contre une liste blanche
# Empêche les domaines non autorisés de se connecter
origines_autorisées = [
    'https://iteam-traffic-light.netlify.app',
    'http://localhost:5173',
    'http://localhost:5174'
]
```

**Limitation de Débit :**
- 10 connexions par IP par fenêtre de 60 secondes
- Implémentation de fenêtre glissante
- Nettoyage automatique des horodatages expirés

**Limites de Connexions :**
- Maximum 100 clients simultanés
- Retourne 503 (Service Indisponible) quand plein
- Pings heartbeat toutes les 30 secondes pour détecter les connexions mortes

**Limites de Taille des Messages :**
- Taille maximale des messages entrants : 1 Ko
- Prévient les attaques par épuisement de mémoire

### 2.6 Stratégie de Diffusion

**Cycle de Mise à Jour :**
```
Toutes les 0,1 secondes :
    - Mettre à jour les minuteries des feux
    - Vérifier les changements de couleur
    
Toutes les 1 seconde :
    - Diffuser les mises à jour des minuteries (si changées)
    
Toutes les 60 secondes :
    - Générer un nouvel état du trafic
    - Créer de nouveaux véhicules
    - Choisir un nouvel événement
    - Diffuser une réinitialisation complète de l'état
```

**Optimisation :**
- Diffuser uniquement quand l'état change
- Suivre les dernières couleurs et minuteries pour éviter les doublons
- Nettoyer les connexions WebSocket mortes

---

## 3. Implémentation du Frontend

### 3.1 Architecture des Composants

Le frontend suit une **architecture modulaire basée sur les composants** :

```
src/
├── ThreeScene.jsx          (Orchestrateur principal)
├── utils/
│   ├── Constants.js        (Configuration)
│   └── TurnHelpers.js      (Calculs de virages)
├── scene/
│   ├── MapBuilders.js      (Génération de cartes)
│   ├── TrafficLights.js    (Rendu des feux)
│   └── VehiclePhysics.js   (Moteur physique)
└── components/
    ├── HUD.jsx             (Affichages d'état)
    ├── LoadingScreen.jsx   (Transitions)
    └── MapSidebar.jsx      (Sélection de carte)
```

### 3.2 Système de Configuration

**Constants.js** centralise toute la configuration :

```javascript
CONFIG = {
    ROAD_WIDTH: 10,
    ROAD_LENGTH: 120,
    LIGHT_DISTANCE: 14,
    TURN_TRIGGER_POSITION: 38,
    ENTERING_TURN_DISTANCE: 2,
    ROTATION_DISTANCE: 9.54,
    EXITING_TURN_DISTANCE: 2
}

PHYSICS = {
    STOP_LINE: 35,
    SAFE_DISTANCE: 4,
    COLLISION_THRESHOLD: 2.5,
    REMOVAL_DISTANCE: 120
}
```

**Avantage :** Source unique de vérité pour ajuster le comportement

### 3.3 Système de Cartes

**Cinq types de cartes distincts :**

1. **Intersection Simple** - Intersection basique à 4 voies
2. **Intersection Pluvieuse** - Asphalte sombre, effets de pluie, aspect mouillé
3. **Intersection Désertique** - Terrain sablonneux, couleurs chaudes
4. **Intersection Enneigée** - Routes blanches, atmosphère hivernale
5. **Grille Urbaine** - Plusieurs intersections en grille

**Approche d'Implémentation :**
```javascript
function buildMapByType(scene, trafficLights, mapId) {
    switch(mapId) {
        case 'rainyIntersection':
            // Asphalte gris foncé
            // Ambiance teintée de bleu
            // Effets de flaques d'eau
        case 'desertIntersection':
            // Texture de sol sablonneux
            // Éclairage chaud
            // Couleurs désertiques
        // ... etc
    }
}
```

**Changement de Carte :**
- Transitions de chargement fluides avec barre de progression
- Nettoyage de la géométrie de la carte précédente
- Préservation de l'état des véhicules pendant la transition
- Animation de fondu entrant/sortant

### 3.4 Moteur Physique des Véhicules

**Machine à États des Virages :**

La physique des véhicules implémente un **système de virages à 4 états** :

```
TOUT_DROIT → ENTRÉE_VIRAGE → ROTATION → SORTIE_VIRAGE → TOUT_DROIT
```

**Détail des États :**

1. **TOUT_DROIT (STRAIGHT)**
   - Mouvement vers l'avant normal
   - Détection de la ligne d'arrêt
   - Respect des feux de circulation
   - Maintien de la distance de sécurité

2. **ENTRÉE_VIRAGE (ENTERING_TURN)** (2 unités)
   - Positionnement pré-virage
   - Approche progressive de l'arc
   - Maintient la direction actuelle

3. **ROTATION (ROTATING)** (9,54 unités)
   - Rotation de 90 degrés sur la distance
   - Trajectoire courbe (interpolation d'arc)
   - Rayons différents pour virages gauche/droite
   - Vitesse réduite de 0,8× pendant le virage

4. **SORTIE_VIRAGE (EXITING_TURN)** (2 unités)
   - Redressement
   - Transition vers la nouvelle direction
   - Changement vers la voie extérieure

**Logique de Direction de Virage :**
```javascript
// Attribution aléatoire lors de l'apparition du véhicule :
directionVirage = random < 0.5 ? 'tout_droit' :
                  random < 0.75 ? 'gauche' : 'droite'
                
// 50% tout droit, 25% gauche, 25% droite
```

**Calcul d'Arc pour les Virages :**
```javascript
// Mélange entre direction actuelle et nouvelle direction
const progressionLissée = sin(progressionVirage × π / 2);

// Virage à droite : rayon plus serré
blendedX = dirActuelle × (1.5 - progression) + nouvDir × progression

// Virage à gauche : rayon plus large avec poussée latérale
blendedX = dirActuelle × (2 - progressionPrécoce) + nouvDir × progressionTardive
pousseeLatérale = sin(progression × π) × 0.4
```

### 3.5 Système de Feux de Circulation

**Composants Visuels :**
- Poteau en acier (rayon 0,15m, hauteur 6m)
- Boîtier (1,0m × 3,0m × 0,8m boîte noire)
- Trois ampoules (rouge, jaune, vert)
- Affichage de minuterie basé sur canvas
- Étiquette de direction (NORD, SUD, EST, OUEST)

**Stratégie de Mise à Jour :**
```javascript
// Mettre à jour uniquement si nécessaire
if (couleur changée) {
    // Atténuer toutes les ampoules
    rouge.color = #330000
    jaune.color = #333300
    vert.color = #003300
    
    // Allumer l'ampoule active
    ampouleActive.color = luminosité maximale
}

if (minuterie changée OU 250ms écoulées) {
    // Redessiner le canvas
    updateTimerDisplay(secondesRestantes)
}
```

**Interpolation de Minuterie :**
```javascript
// Le serveur envoie l'horodatage ExpiresAt
estimatedServerNow = serverTime + (localElapsed - packetTime)
remainingMs = expiresAt - estimatedServerNow
remainingSec = remainingMs / 1000

// Compte à rebours fluide sans saccades
```

### 3.6 Système de Détection des Collisions

**Approche : Vérification de Proximité Spatiale**

```javascript
// Pour chaque paire de véhicules :
const dx = v1.position.x - v2.position.x;
const dz = v1.position.z - v2.position.z;
const distance = sqrt(dx² + dz²);

// Seuils différents :
if (véhicule en virage) {
    seuil = 3.0 unités  // Rayon plus large
} else {
    seuil = 2.5 unités  // Rayon normal
}

if (distance < seuil) {
    COLLISION_DÉTECTÉE
}
```

**Suivi des Collisions :**
- Identifiant de paire unique : `"${id1}-${id2}"`
- Structure de données Set empêche les comptages en double
- Compteur persistant à travers les intervalles de simulation

**Retour Visuel :**
- Compteur de collisions dans le HUD
- Couleur d'avertissement rouge quand des collisions sont détectées

### 3.7 Logique d'Arrêt

**Système de Décision Multi-Facteurs :**

```javascript
// Facteur 1 : État du Feu de Circulation
if (feu est ROUGE ou JAUNE) {
    if (pas encore passé la ligne d'arrêt) {
        // Calculer la décélération
        distanceArrêt = vitesse² / (2 × décélération)
        
        if (position + distanceArrêt >= ligneArrêt) {
            ARRÊT_À_LA_LIGNE
        }
    }
}

// Facteur 2 : Véhicule Devant
if (voiture devant dans la même voie) {
    distanceVoitureDevant = devant.position - position.actuelle
    
    if (distanceVoitureDevant < DISTANCE_SÉCURITÉ + TAMPON) {
        ARRÊT_DERRIÈRE_VOITURE
    }
}

// Facteur 3 : Engagement au Feu Jaune
if (feu est JAUNE) {
    if (tempsRestant <= 1.0s && distance < 10 unités) {
        // Trop proche pour s'arrêter en sécurité
        CONTINUER_ET_PASSER
    }
}
```

**Courbe de Décélération :**
```javascript
if (doitArrêter) {
    const distanceVersArrêt = positionCible - positionActuelle;
    const décélération = 25; // unités/s²
    
    if (distanceVersArrêt > 0.5) {
        // Décélération progressive
        vitesse = max(0, vitesse - décélération × dt);
    } else {
        // Arrêt complet
        vitesse = 0;
    }
}
```

### 3.8 Composants de l'Interface Utilisateur

**Éléments du HUD :**

1. **Statut de Connexion**
   - Indicateur vert quand connecté
   - Indicateur rouge quand déconnecté
   - État WebSocket en temps réel

2. **Bouton Pause**
   - Bascule la simulation
   - Retour visuel (changement de couleur)
   - Animation de survol (échelle 1,05×)

3. **Affichage de la Carte Actuelle**
   - Icône et nom de la carte
   - Couleur de fond depuis la config de carte
   - Toujours visible pendant la simulation

4. **HUD État du Trafic**
   - Affiche l'événement actuel
   - Bordure codée par couleur (rouge/jaune/vert)
   - Montre le statut du flux de trafic

5. **Compteur de Collisions**
   - Comptage persistant
   - Couleur d'avertissement quand > 0
   - Mise à jour en temps réel

6. **Cycle Jour/Nuit**
   - Affichage de l'heure (0-24 heures)
   - Visualisation par barre de progression
   - Changements d'éclairage progressifs

7. **Affichage d'Événement Actif**
   - Grande bannière quand événement actif
   - Icône et description de l'événement
   - Masquage automatique pour trafic normal

8. **Panneau d'Instructions**
   - Contrôles clavier
   - Interactions souris
   - Conseils pour les utilisateurs

**Barre Latérale des Cartes :**
- Disposition en grille des options de carte
- Effets de survol (échelle + lueur)
- Carte actuelle mise en surbrillance
- État de chargement pendant les transitions

**Écran de Chargement :**
- Superposition plein écran
- Barre de progression (0-100%)
- Nom et icône de la carte
- Transitions de fondu fluides

---

## 4. Protocole de Communication

### 4.1 Format des Messages WebSocket

**Serveur → Client (Diffusion d'État) :**

```json
{
  "Lights": [
    {
      "Sens": "N",
      "Couleur": "GREEN",
      "Timer": 27.3,
      "TimerMs": 27300,
      "ExpiresAt": 1737486156234
    }
  ],
  "Vehicles": [
    {
      "Id": 142,
      "Sens": "N",
      "Voie": "Lane1",
      "Position": 15.2,
      "Speed": 12.4,
      "Waiting": false
    }
  ],
  "Traffic": [
    {
      "direction": "N",
      "flow": 18,
      "event": {
        "name": "Rush Hour",
        "flow_mult": 1.8
      }
    }
  ],
  "Event": {
    "name": "Rush Hour",
    "flow_mult": 1.8
  },
  "Interval": 60,
  "Reset": true,
  "ServerTime": 1737486129234
}
```

**Description des Champs :**

- **Lights** : Tableau des états actuels des feux de circulation
  - `Sens` : Direction (N/S/E/O)
  - `Couleur` : Couleur (RED/YELLOW/GREEN)
  - `Timer` : Secondes restantes (flottant)
  - `ExpiresAt` : Horodatage exact quand le timer atteint 0

- **Vehicles** : Tableau des véhicules actifs
  - `Id` : Identifiant unique
  - `Sens` : Direction de déplacement
  - `Voie` : Voie (Lane1 ou Lane2)
  - `Position` : Distance parcourue depuis l'apparition
  - `Speed` : Vitesse actuelle en unités/seconde

- **Traffic** : Informations de flux par direction
  - `flow` : Véhicules par minute
  - `event` : Modificateur de trafic actuel

- **Reset** : Drapeau booléen pour effacer les anciens véhicules
- **ServerTime** : Horodatage actuel du serveur (pour synchronisation)

### 4.2 Cycle de Vie de la Connexion

**1. Établissement de la Connexion :**
```
Client → Serveur : Requête d'upgrade WebSocket
                   Origin: https://iteam-traffic-light.netlify.app

Serveur → Client : 
    SI (origine valide ET limite de débit OK ET places disponibles)
        → 101 Switching Protocols
        → Envoyer l'état actuel immédiatement
    SINON
        → 403 Forbidden (origine invalide)
        → 429 Too Many Requests (limite de débit)
        → 503 Service Unavailable (plein)
```

**2. Connexion Active :**
```
Toutes les 0,1s : Le serveur met à jour les minuteries des feux
Toutes les 1,0s : Le serveur diffuse les changements de feux
Toutes les 30s : Le serveur envoie un ping (heartbeat)
Toutes les 60s : Le serveur génère un nouvel état complet
```

**3. Déconnexion :**
```
Le client ferme → Le serveur retire de l'ensemble des clients
Client non réactif → Timeout heartbeat → Déconnexion automatique
Arrêt du serveur → Fermeture gracieuse de toutes les connexions
```

### 4.3 Synchronisation Temporelle

**Problème :** Les horloges client et serveur peuvent différer, causant des imprécisions de minuterie.

**Solution : Timing Autoritaire du Serveur**

```javascript
// À chaque paquet reçu :
const serverTime = data.ServerTime;
const packetReceivedAt = performance.now();

// Stocker ces valeurs
lastServerTime = serverTime;
lastPacketTime = packetReceivedAt;

// Lors du rendu (chaque frame) :
const localElapsed = performance.now() - lastPacketTime;
const estimatedServerNow = lastServerTime + localElapsed;

// Calculer le temps restant :
const remainingMs = light.ExpiresAt - estimatedServerNow;
const remainingSec = Math.max(0, remainingMs / 1000);
```

**Résultat :** Compte à rebours fluide et précis sans gigue réseau

---

## 5. Caractéristiques Techniques

### 5.1 Système de Caméra

**Contrôles de Caméra Interactifs :**

```javascript
// Glisser la souris pour faire pivoter la caméra
onMouseMove: (dx, dy) => {
    angleAzimutal += dx × 0.003  // Rotation horizontale
    anglePolaire += dy × 0.003   // Rotation verticale
    
    // Limiter l'angle polaire (empêcher le retournement)
    anglePolaire = clamp(0.1, Math.PI - 0.1)
}

// Défilement pour zoomer
onWheel: (delta) => {
    distance += delta × 0.001
    distance = clamp(20, 200)  // Zoom min/max
}

// Convertir sphérique → coordonnées cartésiennes
camera.position.x = distance × sin(polaire) × cos(azimutal)
camera.position.y = distance × cos(polaire)
camera.position.z = distance × sin(polaire) × sin(azimutal)

camera.lookAt(0, 0, 0)  // Toujours regarder le centre
```

**Position Initiale :**
- Distance : 60 unités
- Angle polaire : 65° (vue surélevée)
- Angle azimutal : 45° (perspective diagonale)

### 5.2 Optimisations de Performance

**Réutilisation de Géométrie :**
```javascript
// Créer une géométrie partagée une seule fois
const vehicleGeometry = new BoxGeometry(2, 1, 4);

// Réutiliser pour tous les véhicules (économise la mémoire)
const mesh = new Mesh(vehicleGeometry.clone(), material);
```

**Culling de Frustum :**
- Three.js élimine automatiquement les objets hors écran
- Les véhicules au-delà de 120 unités sont supprimés

**Limitation des Mises à Jour :**
```javascript
// Mises à jour du canvas limitées à 250ms
if (now - lastCanvasUpdate > 250) {
    redrawTimerCanvas();
    lastCanvasUpdate = now;
}
```

**Nettoyage des Connexions Mortes :**
```javascript
// Supprimer les connexions WebSocket fermées
for (ws of clients) {
    if (ws.closed) {
        dead_clients.add(ws);
    }
}
clients.difference_update(dead_clients);
```

### 5.3 Gestion de l'État

**État React :**
```javascript
const [connected, setConnected] = useState(false);
const [paused, setPaused] = useState(false);
const [currentMap, setCurrentMap] = useState('intersection');
const [collisionCount, setCollisionCount] = useState(0);
```

**Refs pour Three.js :**
```javascript
sceneDataRef.current = {
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    vehicles: {},           // id → mesh
    trafficLights: {},      // direction → données du feu
    localVehicles: {},      // id → état physique
    simulationData: null,   // Dernier paquet serveur
    collisionCount: 0,
    collidedPairs: Set      // Suivre les collisions uniques
};
```

**Pourquoi les Refs ?**
- Éviter les re-rendus à chaque frame
- Accès direct aux objets Three.js
- Persister à travers le cycle de vie du composant

### 5.4 Boucle d'Animation

**Rendu à 60 FPS :**

```javascript
function animate() {
    requestAnimationFrame(animate);
    
    if (paused) return;  // Passer quand en pause
    
    const dt = clock.getDelta();
    
    // 1. Mettre à jour la physique
    updateVehiclesPhysics(dt, ...);
    
    // 2. Mettre à jour les meshes des véhicules
    updateVehicleMeshes(vehicles, localVehicles);
    
    // 3. Mettre à jour les feux de circulation
    updateTrafficLights(trafficLights, localLights, dt, serverTime);
    
    // 4. Mettre à jour le cycle jour/nuit
    updateLighting(dayTime);
    
    // 5. Rendre la scène
    renderer.render(scene, camera);
}
```

**Delta Time (dt) :**
- Assure une physique cohérente quel que soit le framerate
- 60 FPS : dt ≈ 0,0167 secondes
- 30 FPS : dt ≈ 0,0333 secondes
- Même comportement à tout framerate

---

## 6. Approche de Développement

### 6.1 Processus de Développement Itératif

**Phase 1 : Preuve de Concept**
- Rendu basique de l'intersection
- Mouvement simple des véhicules
- Machine à états des feux de circulation
- Connexion WebSocket

**Phase 2 : Fonctionnalités Principales**
- Logique de virage appropriée
- Détection des collisions
- Multiples cartes
- Système d'événements
- Logique d'arrêt

**Phase 3 : Finition & UX**
- Composants HUD
- Transitions de chargement
- Changement de carte
- Fonctionnalité pause
- Retour visuel

**Phase 4 : Prêt pour la Production**
- Mesures de sécurité
- Modularisation du code
- Documentation
- Configuration de déploiement
- Optimisation des performances

### 6.2 Approche de Résolution de Problèmes

**Défi : Comportement Réaliste des Virages**

*Problème Initial :* Les véhicules faisant des virages instantanés de 90° semblaient artificiels.

*Évolution de la Solution :*
1. Interpolation d'arc simple → Trop robotique
2. Courbes de Bézier → Difficile à contrôler
3. **Système multi-états avec progression basée sur la distance** ← Solution finale
   - ENTRÉE_VIRAGE : Approche graduelle (2 unités)
   - ROTATION : Trajectoire courbe avec mélange de directions (9,54 unités)
   - SORTIE_VIRAGE : Redressement (2 unités)

**Défi : Minuteries de Feux Fluides**

*Problème Initial :* Les mises à jour serveur toutes les 1 seconde causaient des comptes à rebours saccadés.

*Évolution de la Solution :*
1. Interpolation linéaire entre paquets → Toujours saccadé
2. **Extrapolation côté client utilisant les horodatages ExpiresAt** ← Solution finale
   - Le serveur fournit l'heure exacte d'expiration
   - Le client calcule le temps restant à chaque frame
   - Compte à rebours fluide quel que soit le taux de paquets

**Défi : Détection des Collisions**

*Problème Initial :* Trop de faux positifs, problèmes de performance.

*Évolution de la Solution :*
1. Vérifier toutes les paires chaque frame → O(n²), trop lent
2. Partitionnement spatial → Complexe, sur-ingénierie
3. **Groupement par voie + seuil de distance** ← Solution finale
   - Grouper les véhicules par voie
   - Vérifier uniquement dans les voies identiques/adjacentes
   - Seuils différents pour virage vs tout droit

### 6.3 Philosophie d'Organisation du Code

**Principes Appliqués :**

1. **Séparation des Responsabilités**
   - Logique réseau séparée de la logique de simulation
   - Logique métier séparée du rendu
   - Composants UI isolés de la physique

2. **Responsabilité Unique**
   - Chaque module/composant a un objectif clair
   - Les fonctions font bien une seule chose
   - Constantes centralisées pour ajustement facile

3. **Configuration Plutôt que Code**
   - Tous les nombres magiques dans Constants.js
   - Variables d'environnement pour le déploiement
   - Facile d'ajuster le comportement sans modifier le code

4. **Programmation Défensive**
   - Validation des entrées (messages WebSocket)
   - Vérifications null avant accès aux objets
   - Dégradation gracieuse (gestion de déconnexion)

---

## 7. Stratégie de Déploiement

### 7.1 Configuration d'Environnement

**Environnement de Développement :**
```env
# .env
VITE_WS_URL=ws://localhost:8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
MAX_CLIENTS=100
PROD=0
```

**Environnement de Production :**
```env
# Netlify
VITE_WS_URL=wss://traffic-light-ugoe.onrender.com

# Render
ALLOWED_ORIGINS=https://iteam-traffic-light.netlify.app
MAX_CLIENTS=100
PORT=10000
```

### 7.2 Processus de Build

**Frontend (Netlify) :**
```bash
# Commande de build
npm run build

# Répertoire de sortie
dist/

# Assets
- JavaScript bundlé (code splitting)
- CSS minifié
- Three.js tree-shaken
- Assets gzippés
```

**Backend (Render) :**
```bash
# Commande de build
pip install -r requirements.txt

# Commande de démarrage
python traffic.py

# Processus
- Charger .env
- Initialiser le simulateur
- Démarrer le serveur WebSocket sur PORT
- Point de terminaison health check : /healthz
```

### 7.3 Monitoring

**Point de Terminaison Métriques Backend :**

```
GET /metrics

Réponse :
{
  "connected_clients": 23,
  "max_clients": 100,
  "uptime_intervals": 147,
  "rate_limited_ips": 2
}
```

**Health Check :**

```
GET /healthz

Réponse : "OK" (200)
```

**Logging :**
```
[INFO] Client connecté depuis 93.45.67.89 (24 total)
[INFO] Changement de feu : [('N', 'YELLOW'), ('S', 'YELLOW'), ...]
[INFO] Nouvel état : Trafic Heure de Pointe, 18 véhicules
[WARNING] Limite de débit dépassée pour 192.168.1.100
```

### 7.4 Considérations de Scalabilité

**Limites Actuelles :**
- 100 connexions WebSocket simultanées
- 10 connexions/minute par IP
- Intervalle de mise à jour de 60 secondes

**Options de Scalabilité Future :**
1. Scalabilité horizontale avec load balancer
2. Redis pour état de limitation de débit partagé
3. File de messages pour scénarios à fort trafic
4. CDN pour assets statiques
5. Base de données pour statistiques persistantes

---

## Conclusion

Cette simulation de feux de circulation démontre une application full-stack complète avec :

✅ **Architecture Propre** - Base de code modulaire et maintenable  
✅ **Communication Temps Réel** - WebSocket avec synchronisation appropriée  
✅ **Sécurité Production** - Validation d'origine, limitation de débit, monitoring  
✅ **Expérience Utilisateur Riche** - Visualisation 3D, contrôles interactifs, multiples cartes  
✅ **Prêt pour le Déploiement** - Configuration d'environnement, documentation, configuration d'hébergement  

Le projet met en valeur des pratiques avancées d'ingénierie logicielle incluant les machines à états, la simulation physique, le réseau temps réel et les mesures de sécurité de grade production.

---

**Statistiques du Projet :**

- **Lignes de Code Totales :** ~3 500
- **Modules Frontend :** 12 fichiers
- **Modules Backend :** 3 fichiers
- **Types de Cartes :** 5 environnements distincts
- **Types d'Événements :** 6 scénarios de trafic
- **Taux de Mise à Jour :** 10 updates/seconde (physique), 60 FPS (rendu)
- **Tolérance de Latence Réseau :** ~200ms (dégradation gracieuse)

---

*Fin du Rapport Technique*
