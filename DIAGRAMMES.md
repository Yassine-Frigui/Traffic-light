# Diagrammes du Projet - Simulation de Feux de Circulation

Ce fichier contient les diagrammes architecturaux du système de simulation.

---

## 1. Workflow Global - Flux de Données du Serveur au Frontend

Ce diagramme montre comment les données circulent depuis le backend Python (Render) jusqu'au frontend React (Netlify), avec le rôle de GitHub Actions.

```mermaid
flowchart TB
    subgraph GHA["GitHub Actions (CI/CD)"]
        direction TB
        CRON["Cron Job<br/>Toutes les 14 minutes"]
        PING["HTTP GET /healthz"]
        CRON --> PING
    end
    
    subgraph BACKEND["Backend - Render.com"]
        direction TB
        PY["Python 3.12 + aiohttp"]
        
        subgraph MODULES["Modules Backend"]
            TLC["TrafficLightController<br/>Machine à États<br/>(VERT → JAUNE → ROUGE)"]
            TS["TrafficSimulator<br/>Génération Véhicules<br/>Système d'Événements"]
            WS["WebSocketServer<br/>Validation Origine<br/>Rate Limiting"]
        end
        
        PY --> TLC
        PY --> TS
        PY --> WS
        
        STATE["État du Trafic<br/>{<br/>  Lights: [...],<br/>  Vehicles: [...],<br/>  Event: {...}<br/>}"]
        
        TLC --> STATE
        TS --> STATE
    end
    
    subgraph COMM["Communication"]
        WSC["WebSocket<br/>wss://traffic-light-ugoe.onrender.com<br/>Port 10000<br/>Messages JSON"]
    end
    
    subgraph FRONTEND["Frontend - Netlify"]
        direction TB
        REACT["React 18 + Vite"]
        
        subgraph RENDERING["Composants de Rendu 3D"]
            MB["MapBuilders<br/>5 Environnements"]
            TL["TrafficLights<br/>Feux 3D avec Timer"]
            VP["VehiclePhysics<br/>Physique + Collisions"]
        end
        
        subgraph GUI["Interface Utilisateur"]
            HUD["HUD<br/>Statut + Contrôles"]
            LS["LoadingScreen<br/>Transitions"]
            MS["MapSidebar<br/>Sélecteur Carte"]
        end
        
        REACT --> RENDERING
        REACT --> GUI
        
        SCENE["Scène Three.js<br/>60 FPS<br/>Rendu WebGL"]
        
        RENDERING --> SCENE
    end
    
    subgraph USER["Utilisateur"]
        BROWSER["Navigateur Web<br/>Chrome/Firefox/Edge"]
    end
    
    %% Flux GitHub Actions
    PING -.->|"Keep Alive"| WS
    WS -.->|"200 OK"| PING
    
    %% Flux Backend vers Frontend
    STATE -->|"Broadcast"| WS
    WS -->|"JSON Messages"| WSC
    WSC -->|"État Reçu"| REACT
    
    %% Flux Frontend vers User
    SCENE -->|"Canvas 3D"| BROWSER
    GUI -->|"Interface HTML"| BROWSER
    
    %% Styles
    style GHA fill:#2088ff,stroke:#000,stroke-width:2px,color:#fff
    style BACKEND fill:#3776ab,stroke:#000,stroke-width:2px,color:#fff
    style FRONTEND fill:#61dafb,stroke:#000,stroke-width:2px,color:#000
    style COMM fill:#f9dc5c,stroke:#000,stroke-width:3px
    style STATE fill:#90EE90,stroke:#000,stroke-width:2px
    style SCENE fill:#FF6B6B,stroke:#000,stroke-width:2px
    style RENDERING fill:#4ECDC4,stroke:#000,stroke-width:2px
    style GUI fill:#FFE66D,stroke:#000,stroke-width:2px
```

### Version Alternative (Flux de Données ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS (CI/CD)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Cron: */14 * * * * (Toutes les 14 minutes)              │  │
│  │  Action: curl GET https://.../healthz                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP GET (Keep Server Alive)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND - RENDER.COM (Python 3.12)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  traffic_simulation.py                                   │   │
│  │  ┌────────────────────┐   ┌────────────────────────┐    │   │
│  │  │TrafficLightCtrl    │   │ TrafficSimulator       │    │   │
│  │  │- update_timers()   │   │- generate_vehicles()   │    │   │
│  │  │- check_transition()│   │- apply_events()        │    │   │
│  │  │  VERT → JAUNE      │   │- calculate_flow()      │    │   │
│  │  │  JAUNE → ROUGE     │   └────────────────────────┘    │   │
│  │  └────────────────────┘                                  │   │
│  │                                                           │   │
│  │  État du Trafic (JSON):                                  │   │
│  │  {                                                        │   │
│  │    "Lights": [                                           │   │
│  │      {"Sens": "N", "Couleur": "GREEN", "Timer": 25.3}   │   │
│  │    ],                                                     │   │
│  │    "Vehicles": [                                         │   │
│  │      {"Id": 42, "Sens": "S", "Position": 12.5}          │   │
│  │    ],                                                     │   │
│  │    "Event": {"name": "Rush Hour", "flow_mult": 1.8}     │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  server.py (WebSocketServer)                             │   │
│  │  - validate_origin()   ✓ Sécurité                        │   │
│  │  - check_rate_limit()  ✓ Rate Limiting                   │   │
│  │  - broadcast_state()   → Diffusion à tous les clients    │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ WebSocket (wss://)
                            │ Messages JSON toutes les 0.1s - 60s
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             FRONTEND - NETLIFY (React 18 + Three.js)            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ThreeScene.jsx (Orchestrateur)                          │   │
│  │  - Connexion WebSocket                                   │   │
│  │  - Réception des états JSON                              │   │
│  │  - Dispatch vers composants                              │   │
│  └──────────────────┬───────────────────┬───────────────────┘   │
│                     │                   │                        │
│     ┌───────────────▼──────┐    ┌──────▼────────────────┐       │
│     │ RENDU 3D             │    │ INTERFACE GUI          │       │
│     │                      │    │                        │       │
│     │ • MapBuilders.js     │    │ • HUD.jsx              │       │
│     │   └→ 5 Cartes 3D     │    │   └→ Statut + Pause    │       │
│     │                      │    │                        │       │
│     │ • TrafficLights.js   │    │ • LoadingScreen.jsx    │       │
│     │   └→ Feux + Timer    │    │   └→ Transitions       │       │
│     │                      │    │                        │       │
│     │ • VehiclePhysics.js  │    │ • MapSidebar.jsx       │       │
│     │   └→ Physique        │    │   └→ Choix Carte       │       │
│     │   └→ Collisions      │    │                        │       │
│     └──────────┬───────────┘    └────────┬───────────────┘       │
│                │                         │                        │
│                └─────────┬───────────────┘                        │
│                          ▼                                        │
│              ┌─────────────────────────┐                          │
│              │  Scène Three.js         │                          │
│              │  - Camera               │                          │
│              │  - Lights               │                          │
│              │  - Renderer (WebGL)     │                          │
│              │  - 60 FPS Animation     │                          │
│              └─────────────────────────┘                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Canvas 3D + Interface HTML
                            ▼
                   ┌─────────────────┐
                   │   Navigateur    │
                   │   Utilisateur   │
                   └─────────────────┘
```

---

## 2. Architecture Frontend - Comportement des Fichiers

Ce diagramme montre comment chaque fichier se comporte et comment ils fusionnent vers le frontend final.

```mermaid
flowchart TB
    subgraph ENTRY["Point d'Entrée"]
        HTML["index.html"]
        MAIN["main.jsx"]
    end
    
    subgraph ORCHESTRATOR["Orchestrateur Central"]
        TS["ThreeScene.jsx<br/>━━━━━━━━━━━━━━<br/>• Connexion WebSocket<br/>• Initialisation Three.js<br/>• Boucle Animation (60 FPS)<br/>• État Global (useRef)"]
    end
    
    subgraph UTILS["Utilitaires"]
        CONST["Constants.js<br/>Configuration:<br/>- PHYSICS<br/>- MAP_CONFIGS<br/>- VEHICLE_COLORS"]
        TURN["TurnHelpers.js<br/>Calculs:<br/>- Trajectoires<br/>- Rotations"]
    end
    
    subgraph RENDERING["Composants de Rendu 3D"]
        direction TB
        MB["MapBuilders.js<br/>━━━━━━━━━━━━━━<br/>Génère les 5 Cartes 3D:<br/>• Simple Intersection<br/>• Rainy (Pluie)<br/>• Desert<br/>• Snowy (Neige)<br/>• City Grid"]
        
        TLI["TrafficLights.js<br/>━━━━━━━━━━━━━━<br/>Construit Feux 3D:<br/>• Poteaux (BoxGeometry)<br/>• Boîtiers métalliques<br/>• Ampoules (R/Y/G)<br/>• Canvas Timer dynamique"]
        
        VP["VehiclePhysics.js<br/>━━━━━━━━━━━━━━<br/>Moteur Physique:<br/>• Machine à États<br/>  (STRAIGHT → TURN)<br/>• Détection Collisions<br/>• Gestion Freinage"]
    end
    
    subgraph GUI["Interface Utilisateur GUI"]
        direction TB
        HUD["HUD.jsx<br/>━━━━━━━━━━━━━━<br/>Affichage Overlay:<br/>• Statut Connexion<br/>• Bouton Pause/Play<br/>• Compteur Collisions<br/>• Événement Actif"]
        
        SIDEBAR["MapSidebar.jsx<br/>━━━━━━━━━━━━━━<br/>Sélecteur de Carte:<br/>• 5 boutons cliquables<br/>• Changement de map"]
        
        LOADING["LoadingScreen.jsx<br/>━━━━━━━━━━━━━━<br/>Écran de Transition:<br/>• Barre progression<br/>• Animation fluide"]
    end
    
    subgraph OUTPUT["Sortie Finale"]
        SCENE["Scène Three.js<br/>━━━━━━━━━━━━━━<br/>WebGL Renderer<br/>Camera + Lumières<br/>60 FPS"]
        
        CANVAS["Canvas 3D +<br/>Interface HTML"]
    end
    
    %% Flux Point d'Entrée
    HTML --> MAIN
    MAIN --> TS
    
    %% Flux Utilitaires
    CONST -.->|"Config"| TS
    TURN -.->|"Helpers"| VP
    CONST -.->|"Params"| VP
    
    %% Flux Rendu 3D vers Orchestrateur
    MB -->|"Géométries 3D"| TS
    TLI -->|"Meshes Feux"| TS
    VP -->|"Update Loop"| TS
    
    %% Flux GUI vers Orchestrateur
    HUD -->|"État UI"| TS
    SIDEBAR -->|"Événements"| TS
    LOADING -->|"Affichage"| TS
    
    %% Flux vers Scène
    TS -->|"Ajoute à Scene"| SCENE
    
    %% Flux vers Output
    SCENE --> CANVAS
    HUD --> CANVAS
    SIDEBAR --> CANVAS
    LOADING --> CANVAS
    
    %% Styles
    style TS fill:#61dafb,stroke:#000,stroke-width:4px,color:#000
    style RENDERING fill:#4ECDC4,stroke:#000,stroke-width:2px
    style GUI fill:#FFE66D,stroke:#000,stroke-width:2px
    style SCENE fill:#FF6B6B,stroke:#000,stroke-width:3px
    style CANVAS fill:#95E1D3,stroke:#000,stroke-width:3px
    style MB fill:#4ECDC4,stroke:#000,stroke-width:2px
    style TLI fill:#4ECDC4,stroke:#000,stroke-width:2px
    style VP fill:#4ECDC4,stroke:#000,stroke-width:2px
    style HUD fill:#FFE66D,stroke:#000,stroke-width:2px
    style SIDEBAR fill:#FFE66D,stroke:#000,stroke-width:2px
    style LOADING fill:#FFE66D,stroke:#000,stroke-width:2px
```

### Version Alternative (Flux des Fichiers)

```
┌─────────────────────────────────────────────────────────────────┐
│                    POINT D'ENTRÉE                               │
│  index.html  →  main.jsx  →  Montage React DOM                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ORCHESTRATEUR: ThreeScene.jsx                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Connexion WebSocket (useEffect)                       │   │
│  │  • Initialisation Three.js (Scene, Camera, Renderer)    │   │
│  │  • Boucle d'Animation 60 FPS (requestAnimationFrame)    │   │
│  │  • État Global (useRef pour scene, vehicles, lights)    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────┬────────────────────────────┬──────────────────┬──────────┘
       │                            │                  │
       │                            │                  │
   ┌───▼──────┐              ┌──────▼──────────┐  ┌───▼──────────┐
   │ UTILS    │              │ RENDU 3D        │  │ GUI          │
   │          │              │                 │  │              │
   │ Const... │◄─────────────┤ MapBuilders.js  │  │ HUD.jsx      │
   │ Turn...  │              │ ━━━━━━━━━━━━━━━ │  │ ━━━━━━━━━━━━ │
   └──────────┘              │ Comportement:   │  │ Comportement:│
       ▲                     │ - buildSimple   │  │ - Affiche    │
       │                     │   Intersection  │  │   statut WS  │
       │                     │ - buildRainy    │  │ - Bouton     │
       │                     │ - buildDesert   │  │   Pause/Play │
       │                     │ - buildSnowy    │  │ - Compteur   │
       │                     │ - buildCityGrid │  │   collisions │
       │                     │ ━━━━━━━━━━━━━━━ │  │ ━━━━━━━━━━━━ │
       │                     │ Retour:         │  │ Retour:      │
       │                     │ ✓ Géométries    │  │ ✓ JSX Comp.  │
       │                     │ ✓ Meshes 3D     │  └──────┬───────┘
       │                     │ ✓ Materials     │         │
       │                     └────────┬────────┘         │
       │                              │                  │
       │                     ┌────────▼────────┐         │
       │                     │TrafficLights.js │         │
       │                     │━━━━━━━━━━━━━━━━ │  ┌──────▼──────┐
       │                     │ Comportement:   │  │MapSidebar   │
       │                     │ - buildTraffic  │  │  .jsx       │
       │                     │   Lights()      │  │━━━━━━━━━━━━ │
       │                     │ - Canvas pour   │  │Comportement:│
       │                     │   Timer         │  │- 5 boutons  │
       │                     │ - updateLights  │  │- onClick    │
       │                     │ ━━━━━━━━━━━━━━━ │  │- Change map │
       │                     │ Retour:         │  │━━━━━━━━━━━━ │
       │                     │ ✓ Feux 3D       │  │Retour:      │
       │                     │ ✓ Ampoules R/Y/G│  │✓ JSX Comp.  │
       │                     └────────┬────────┘  └──────┬───────┘
       │                              │                  │
       │                     ┌────────▼────────┐         │
       │                     │VehiclePhysics.js│  ┌──────▼──────┐
       └─────────────────────┤━━━━━━━━━━━━━━━━ │  │LoadingScreen│
                             │ Comportement:   │  │  .jsx       │
                             │ - updateVehicles│  │━━━━━━━━━━━━ │
                             │   Physics()     │  │Comportement:│
                             │ - Machine à     │  │- Affiche    │
                             │   États (TURN)  │  │  pendant    │
                             │ - checkCollision│  │  transition │
                             │ ━━━━━━━━━━━━━━━ │  │- Progress   │
                             │ Retour:         │  │  bar        │
                             │ ✓ Positions     │  │━━━━━━━━━━━━ │
                             │ ✓ Rotations     │  │Retour:      │
                             │ ✓ Collision     │  │✓ JSX Comp.  │
                             │   Count         │  └──────┬───────┘
                             └────────┬────────┘         │
                                      │                  │
    ┌─────────────────────────────────┼──────────────────┘
    │                                 │
    │         FUSION DANS L'ORCHESTRATEUR (ThreeScene.jsx)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SCÈNE THREE.JS                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Scene (THREE.Scene)                                     │   │
│  │    ├── Géométries de MapBuilders (Routes, Bâtiments)    │   │
│  │    ├── Meshes de TrafficLights (Feux 3D + Timers)       │   │
│  │    ├── Meshes de Véhicules (mis à jour par Physics)     │   │
│  │    ├── Camera (PerspectiveCamera)                       │   │
│  │    └── Lumières (AmbientLight, DirectionalLight)        │   │
│  │                                                          │   │
│  │  WebGLRenderer.render(scene, camera)  →  60 FPS         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SORTIE FINALE FRONTEND                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CANVAS 3D (Three.js Renderer)                           │   │
│  │    └── Animation 3D de l'intersection                    │   │
│  │                                                           │   │
│  │  + INTERFACE HTML (Composants React)                     │   │
│  │    ├── HUD (overlay en haut)                             │   │
│  │    ├── MapSidebar (à droite)                             │   │
│  │    └── LoadingScreen (transitions)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│              Affiché dans le Navigateur Utilisateur             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Backend Python - Structure des Fichiers

Ce diagramme montre comment les fichiers Python se comportent et interagissent dans le backend.

```mermaid
flowchart TB
    subgraph ENTRY["Point d'Entrée Backend"]
        MAIN["traffic.py<br/>━━━━━━━━━━━━━━<br/>• Point d'entrée principal<br/>• Charge .env<br/>• Crée instances<br/>• Gère lifecycle"]
    end
    
    subgraph CONFIG["Configuration"]
        ENV[".env<br/>━━━━━━━━━━━━━━<br/>PORT=10000<br/>ALLOWED_ORIGINS<br/>MAX_CLIENTS=100"]
        REQ["requirements.txt<br/>━━━━━━━━━━━━━━<br/>aiohttp==3.9<br/>python-dotenv"]
    end
    
    subgraph BUSINESS["Logique Métier"]
        direction TB
        SIM["traffic_simulation.py<br/>━━━━━━━━━━━━━━━━━━━━━"]
        
        TLC["TrafficLightController<br/>━━━━━━━━━━━━━━<br/>Comportement:<br/>• update_timers(delta)<br/>• check_transition()<br/>• Machine à États<br/>━━━━━━━━━━━━━━<br/>État:<br/>- lights: Dict<br/>  {'N': 'GREEN',<br/>   'S': 'GREEN',<br/>   'E': 'RED',<br/>   'W': 'RED'}<br/>- timers: Dict<br/>━━━━━━━━━━━━━━<br/>Retour:<br/>✓ État feux JSON"]
        
        TS["TrafficSimulator<br/>━━━━━━━━━━━━━━<br/>Comportement:<br/>• generate_vehicles()<br/>• choose_event()<br/>• apply_event_flow()<br/>━━━━━━━━━━━━━━<br/>État:<br/>- vehicle_id_counter<br/>- current_event<br/>- traffic_controller<br/>━━━━━━━━━━━━━━<br/>Retour:<br/>✓ Liste véhicules<br/>✓ Événement actif<br/>✓ État complet JSON"]
        
        SIM --> TLC
        SIM --> TS
    end
    
    subgraph NETWORK["Couche Réseau"]
        direction TB
        SRV["server.py<br/>━━━━━━━━━━━━━━━━━━━━━"]
        
        WSS["WebSocketServer<br/>━━━━━━━━━━━━━━<br/>Comportement:<br/>• validate_origin()<br/>• check_rate_limit()<br/>• handle_client(ws)<br/>• broadcast_state()<br/>• cleanup_dead_connections()<br/>━━━━━━━━━━━━━━<br/>État:<br/>- clients: Set[WebSocket]<br/>- rate_limit_store: Dict<br/>- simulator: TrafficSimulator<br/>━━━━━━━━━━━━━━<br/>Sécurité:<br/>✓ Origin validation<br/>✓ 10 conn/min/IP<br/>✓ Max 100 clients<br/>✓ Heartbeat 30s"]
        
        HTTP["Routes HTTP<br/>━━━━━━━━━━━━━━<br/>GET /healthz<br/>→ 200 OK<br/><br/>GET /metrics<br/>→ JSON stats"]
        
        SRV --> WSS
        SRV --> HTTP
    end
    
    subgraph OUTPUT["Sortie Réseau"]
        WS_OUT["Messages WebSocket<br/>━━━━━━━━━━━━━━<br/>JSON Format:<br/>{<br/>  'Lights': [...],<br/>  'Vehicles': [...],<br/>  'Event': {...},<br/>  'ServerTime': ...,<br/>  'Reset': bool<br/>}"]
    end
    
    %% Flux principal
    MAIN --> ENV
    MAIN --> REQ
    MAIN --> SIM
    MAIN --> SRV
    
    ENV -.->|"Variables"| MAIN
    
    SIM --> SRV
    TLC -.->|"État feux"| TS
    TS -.->|"État complet"| WSS
    
    WSS -->|"Broadcast"| WS_OUT
    HTTP -->|"Health"| WS_OUT
    
    %% Styles
    style MAIN fill:#3776ab,stroke:#000,stroke-width:4px,color:#fff
    style SIM fill:#4ECDC4,stroke:#000,stroke-width:3px
    style SRV fill:#FF6B6B,stroke:#000,stroke-width:3px
    style TLC fill:#95E1D3,stroke:#000,stroke-width:2px
    style TS fill:#95E1D3,stroke:#000,stroke-width:2px
    style WSS fill:#FFE66D,stroke:#000,stroke-width:2px
    style HTTP fill:#FFE66D,stroke:#000,stroke-width:2px
    style WS_OUT fill:#F38181,stroke:#000,stroke-width:3px
```

### Version Alternative (Structure Backend)

```
┌─────────────────────────────────────────────────────────────────┐
│                    POINT D'ENTRÉE: traffic.py                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • load_dotenv() → Charge variables .env                │   │
│  │  • simulator = TrafficSimulator()                       │   │
│  │  • server = WebSocketServer(simulator)                  │   │
│  │  • app.run() → Lance serveur aiohttp                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────┬──────────────────────────────┬────────────────┬──────────┘
       │                              │                │
       │                              │                │
   ┌───▼──────┐              ┌────────▼────────┐  ┌───▼──────────┐
   │ CONFIG   │              │ LOGIQUE MÉTIER  │  │ RÉSEAU       │
   │          │              │                 │  │              │
   │ .env     │              │ traffic_        │  │ server.py    │
   │ ├─ PORT  │              │ simulation.py   │  │ ━━━━━━━━━━━━ │
   │ ├─ ORIGINS│             │ ━━━━━━━━━━━━━━━ │  │              │
   │ └─ MAX...│              │                 │  │ WebSocket    │
   │          │              │ TrafficLight    │  │ Server:      │
   │ requirements│           │ Controller      │  │              │
   │ .txt     │              │ ━━━━━━━━━━━━━━━ │  │ - validate   │
   │ ├─ aiohttp│             │ Comportement:   │  │   _origin()  │
   │ └─ dotenv│              │ - update_timers │  │ - check_rate │
   └──────────┘              │ - check_        │  │   _limit()   │
                             │   transition    │  │ - handle_    │
                             │                 │  │   client()   │
                             │ Machine États:  │  │ - broadcast  │
                             │ GREEN → YELLOW  │  │   _state()   │
                             │ YELLOW → RED    │  │              │
                             │ RED → GREEN     │  │ Sécurité:    │
                             │                 │  │ ✓ 10/min/IP  │
                             │ État:           │  │ ✓ Max 100    │
                             │ {               │  │ ✓ Heartbeat  │
                             │   'N': 'GREEN', │  │              │
                             │   'S': 'GREEN', │  │ Routes HTTP: │
                             │   'E': 'RED',   │  │ GET /healthz │
                             │   'W': 'RED'    │  │ GET /metrics │
                             │ }               │  │              │
                             │ ━━━━━━━━━━━━━━━ │  └──────┬───────┘
                             │                 │         │
                             │ TrafficSimulator│         │
                             │ ━━━━━━━━━━━━━━━ │         │
                             │ Comportement:   │         │
                             │ - generate_     │         │
                             │   vehicles()    │         │
                             │ - choose_event()│         │
                             │ - apply_event   │         │
                             │   _flow()       │         │
                             │                 │         │
                             │ État:           │         │
                             │ - vehicle_id    │         │
                             │ - current_event │         │
                             │ - controller    │         │
                             │                 │         │
                             │ Événements:     │         │
                             │ • Rush Hour     │         │
                             │ • Accident      │         │
                             │ • Bad Weather   │         │
                             │ • Nearby Event  │         │
                             │ • Construction  │         │
                             └────────┬────────┘         │
                                      │                  │
    ┌─────────────────────────────────┼──────────────────┘
    │                                 │
    │         FUSION DANS server.py (WebSocketServer)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│              DIFFUSION VERS CLIENTS WEBSOCKET                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Toutes les 0.1s - 60s:                                  │   │
│  │  {                                                        │   │
│  │    "Lights": [                                           │   │
│  │      {"Sens": "N", "Couleur": "GREEN", "Timer": 25.3,   │   │
│  │       "ExpiresAt": 1737486156234}                        │   │
│  │    ],                                                     │   │
│  │    "Vehicles": [                                         │   │
│  │      {"Id": 42, "Sens": "S", "Voie": "Lane1",           │   │
│  │       "Position": 12.5, "Speed": 11.2}                  │   │
│  │    ],                                                     │   │
│  │    "Event": {                                            │   │
│  │      "name": "Rush Hour",                                │   │
│  │      "flow_mult": 1.8                                    │   │
│  │    },                                                     │   │
│  │    "ServerTime": 1737486129234,                          │   │
│  │    "Reset": true                                         │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│     Broadcast à tous les clients WebSocket connectés            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Diagramme de Déploiement

Ce diagramme montre l'infrastructure de déploiement complète avec les plateformes d'hébergement.

```mermaid
flowchart TB
    subgraph DEVELOPER["Développeur"]
        DEV["Poste de<br/>Développement<br/>Windows 11"]
        VSCODE["VS Code<br/>Git"]
    end
    
    subgraph GITHUB["GitHub Repository"]
        REPO["Repository:<br/>Traffic-light<br/>Branch: master"]
        ACTIONS["GitHub Actions<br/>━━━━━━━━━━━━━━<br/>Workflow: Keep Alive<br/>Cron: */14 * * * *<br/>Action: curl /healthz"]
    end
    
    subgraph NETLIFY_CLOUD["Netlify CDN"]
        direction TB
        NETLIFY["Netlify<br/>━━━━━━━━━━━━━━<br/>Auto-Deploy"]
        
        BUILD["Build Process<br/>━━━━━━━━━━━━━━<br/>$ npm install<br/>$ npm run build"]
        
        CDN["CDN Global<br/>━━━━━━━━━━━━━━<br/>Edge Servers<br/>SSL/TLS Cert<br/>dist/ folder"]
        
        NETLIFY --> BUILD
        BUILD --> CDN
    end
    
    subgraph RENDER_CLOUD["Render.com"]
        direction TB
        RENDER["Render Service<br/>━━━━━━━━━━━━━━<br/>Web Service<br/>Python 3.12"]
        
        DOCKER["Container<br/>━━━━━━━━━━━━━━<br/>pip install -r<br/>requirements.txt<br/>python traffic.py"]
        
        BACKEND_RUN["Backend Running<br/>━━━━━━━━━━━━━━<br/>aiohttp server<br/>Port 10000<br/>WebSocket Ready"]
        
        RENDER --> DOCKER
        DOCKER --> BACKEND_RUN
    end
    
    subgraph USERS["Utilisateurs Finaux"]
        USER1["Client 1<br/>Chrome"]
        USER2["Client 2<br/>Firefox"]
        USER3["Client ...<br/>Edge/Safari"]
    end
    
    %% Flux de développement
    DEV --> VSCODE
    VSCODE -->|"git push"| REPO
    
    %% Flux de déploiement
    REPO -->|"Auto Deploy<br/>Frontend"| NETLIFY
    REPO -->|"Auto Deploy<br/>Backend"| RENDER
    REPO --> ACTIONS
    
    %% Flux GitHub Actions
    ACTIONS -.->|"HTTP GET<br/>/healthz<br/>Toutes les 14min"| BACKEND_RUN
    BACKEND_RUN -.->|"200 OK"| ACTIONS
    
    %% Flux utilisateurs vers CDN
    USER1 -->|"HTTPS<br/>iteam-traffic-light<br/>.netlify.app"| CDN
    USER2 -->|"HTTPS"| CDN
    USER3 -->|"HTTPS"| CDN
    
    %% Flux WebSocket
    CDN <-.->|"WebSocket<br/>wss://<br/>traffic-light-ugoe<br/>.onrender.com"| BACKEND_RUN
    
    %% URLs
    CDN -.->|"Serve Static<br/>React App"| USER1
    CDN -.->|"HTML/JS/CSS"| USER2
    CDN -.->|"Assets"| USER3
    
    %% Styles
    style DEVELOPER fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px
    style GITHUB fill:#F3E5F5,stroke:#9C27B0,stroke-width:2px
    style NETLIFY_CLOUD fill:#E1F5FE,stroke:#03A9F4,stroke-width:3px
    style RENDER_CLOUD fill:#FFF3E0,stroke:#FF9800,stroke-width:3px
    style USERS fill:#FCE4EC,stroke:#E91E63,stroke-width:2px
    
    style REPO fill:#9C27B0,stroke:#000,stroke-width:2px,color:#fff
    style ACTIONS fill:#2088ff,stroke:#000,stroke-width:2px,color:#fff
    style CDN fill:#61dafb,stroke:#000,stroke-width:2px,color:#000
    style BACKEND_RUN fill:#3776ab,stroke:#000,stroke-width:2px,color:#fff
```

### Version Alternative (Infrastructure de Déploiement)

```
┌─────────────────────────────────────────────────────────────────┐
│                        DÉVELOPPEUR                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Poste Windows 11 + VS Code + Git                       │   │
│  │  $ git add .                                             │   │
│  │  $ git commit -m "feature"                               │   │
│  │  $ git push origin master                                │   │
│  └───────────────────────────┬──────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GITHUB REPOSITORY                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Repository: Yassine-Frigui/Traffic-light               │   │
│  │  Branch: master                                          │   │
│  │                                                          │   │
│  │  ├── src/                    (Frontend React)           │   │
│  │  ├── traffic.py              (Backend Python)           │   │
│  │  ├── .github/workflows/      (CI/CD)                    │   │
│  │  ├── netlify.toml                                       │   │
│  │  └── requirements.txt                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GitHub Actions Workflow                                │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │  name: Keep Alive                                       │   │
│  │  on:                                                    │   │
│  │    schedule:                                            │   │
│  │      - cron: '*/14 * * * *'  # Toutes les 14 min       │   │
│  │  jobs:                                                  │   │
│  │    ping:                                                │   │
│  │      steps:                                             │   │
│  │        - run: curl GET .../healthz                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────┬────────────────────────────────┬─────────┬─────────────┘
         │                                │         │
         │ Auto Deploy                    │         │ HTTP GET
         │ (on push)                      │         │ /healthz
         │                                │         │ (ping)
         ▼                                ▼         ▼
┌─────────────────────┐      ┌──────────────────────────────────┐
│   NETLIFY CDN       │      │      RENDER.COM                  │
│   ━━━━━━━━━━━━━━━━  │      │      ━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                     │      │                                  │
│  Build Process:     │      │  Build Process:                  │
│  ┌────────────────┐ │      │  ┌──────────────────────────┐   │
│  │ 1. npm install │ │      │  │ 1. pip install -r        │   │
│  │ 2. npm run     │ │      │  │    requirements.txt      │   │
│  │    build       │ │      │  │ 2. python traffic.py     │   │
│  └────────┬───────┘ │      │  └────────┬─────────────────┘   │
│           │         │      │            │                     │
│           ▼         │      │            ▼                     │
│  ┌────────────────┐ │      │  ┌──────────────────────────┐   │
│  │ CDN Global     │ │      │  │ Backend Server Running   │   │
│  │ Edge Servers   │ │      │  │ ━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │ SSL/TLS Auto   │ │      │  │ • Python 3.12 Container  │   │
│  │                │ │      │  │ • aiohttp on Port 10000  │   │
│  │ Serve:         │ │      │  │ • WebSocket Server       │   │
│  │ dist/          │ │      │  │ • Traffic Simulation     │   │
│  │ ├─ index.html  │ │      │  │                          │   │
│  │ ├─ assets/     │ │      │  │ Endpoints:               │   │
│  │ └─ *.js, *.css │ │      │  │ • GET /healthz → 200 OK  │   │
│  └────────┬───────┘ │      │  │ • GET /metrics → JSON    │   │
│           │         │      │  │ • WS  /ws → WebSocket    │   │
│  URL:              │      │  └────────┬─────────────────┘   │
│  iteam-traffic-    │      │            │                     │
│  light.netlify.app │      │  URL:                            │
└───────────┬─────────┘      │  traffic-light-ugoe              │
            │                │  .onrender.com                   │
            │                └────────┬─────────────────────────┘
            │                         │
            │                         │ WebSocket
            │    ┌────────────────────┘ (wss://)
            │    │                      
            │    │ ┌──────────────────────────────────────────┐
            └────┼─►  GitHub Actions Ping (Keep Alive)       │
                 │ │  HTTP GET /healthz                        │
                 │ │  Backend responds: 200 OK                 │
                 │ │  Prevents server sleep                    │
                 │ └──────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATEURS FINAUX                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Client 1    │    │  Client 2    │    │  Client N    │      │
│  │  Chrome      │    │  Firefox     │    │  Edge/Safari │      │
│  │              │    │              │    │              │      │
│  │  1. HTTPS    │    │  1. HTTPS    │    │  1. HTTPS    │      │
│  │  ↓ HTML/JS   │    │  ↓ HTML/JS   │    │  ↓ HTML/JS   │      │
│  │  ← Netlify   │    │  ← Netlify   │    │  ← Netlify   │      │
│  │              │    │              │    │              │      │
│  │  2. WSS      │    │  2. WSS      │    │  2. WSS      │      │
│  │  ↔ JSON      │    │  ↔ JSON      │    │  ↔ JSON      │      │
│  │  ↔ Render    │    │  ↔ Render    │    │  ↔ Render    │      │
│  │              │    │              │    │              │      │
│  │  3. Rendu 3D │    │  3. Rendu 3D │    │  3. Rendu 3D │      │
│  │  🎨 Three.js │    │  🎨 Three.js │    │  🎨 Three.js │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘

FLUX DE DONNÉES:
1. Développeur push → GitHub → Auto-deploy (Netlify + Render)
2. GitHub Actions → Ping backend /healthz toutes les 14 min
3. Utilisateur → HTTPS vers Netlify CDN → Récupère app React
4. App React → WebSocket vers Render backend → Simulation temps réel
5. Backend → Broadcast états → Tous les clients connectés
```

---

## 3. Diagramme UML - Diagramme de Séquence (PlantUML)

Ce diagramme montre l'interaction temporelle entre les différents composants du système.

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam sequenceMessageAlign center
skinparam shadowing false
skinparam ParticipantPadding 20
skinparam BoxPadding 10

title Système de Simulation de Feux de Circulation - Diagramme de Séquence

actor Utilisateur as User
participant "Navigateur\nWeb" as Browser
participant "Frontend\n(Netlify)" as Frontend
participant "WebSocket\nConnection" as WS
participant "Backend\n(Render)" as Backend
participant "GitHub\nActions" as GHA

== Workflow de Maintien du Serveur ==
activate GHA
GHA -> Backend : GET /healthz\n(Toutes les 14 min)
activate Backend
Backend --> GHA : 200 OK
deactivate Backend
deactivate GHA

== Connexion Initiale ==
User -> Browser : Accès à l'application\nhttps://iteam-traffic-light.netlify.app
activate Browser
Browser -> Frontend : Requête HTTP
activate Frontend
Frontend --> Browser : HTML + JS Bundle
Browser -> Browser : Parse HTML\nCharger React + Three.js

Browser -> Frontend : Montage React\n(ReactDOM.render)
Frontend -> Frontend : useEffect() déclenché\nInitialisation

Frontend -> WS : new WebSocket(\n"wss://traffic-light-ugoe.onrender.com")
activate WS
WS -> Backend : Upgrade: websocket\nOrigin: netlify.app
activate Backend

Backend -> Backend : validate_origin()\ncheck_rate_limit()

alt Validation Réussie
    Backend --> WS : 101 Switching Protocols
    WS --> Frontend : onopen event
    
    Backend -> Backend : Ajouter client à la liste
    Backend -> Backend : Générer état initial
    
    Backend -> WS : État Initial JSON:\n{\n  "Lights": [...],\n  "Vehicles": [...],\n  "Event": {...}\n}
    WS -> Frontend : onmessage event
    
    Frontend -> Frontend : Initialiser Scène Three.js:\n- buildMap()\n- buildTrafficLights()\n- Créer véhicules
    
    Frontend -> Browser : Rendu Canvas 3D +\nInterface (HUD, Sidebar)
    Browser -> User : Afficher simulation 3D
    
else Validation Échouée
    Backend --> WS : 403 Forbidden / 429 Rate Limited
    WS --> Frontend : onerror event
    Frontend -> Browser : Afficher message d'erreur
    Browser -> User : "Connexion refusée"
end

== Boucle de Simulation Temps Réel ==

loop Toutes les 0.1 secondes
    Backend -> Backend : update_timers()\ncheck_transitions()
end

loop Toutes les 1 seconde (si changement)
    Backend -> Backend : État feux modifié ?\nVERT → JAUNE → ROUGE
    Backend -> WS : Broadcast état feux:\n{"Lights": [...]}
    WS -> Frontend : onmessage event
    Frontend -> Frontend : updateTrafficLights():\nChanger couleur ampoules\nMettre à jour Canvas Timer
    Frontend -> Browser : Rendu frame 3D
end

loop Toutes les 60 secondes
    Backend -> Backend : generate_vehicles()\nchoose_new_event()
    Backend -> WS : Broadcast complet:\n{\n  "Reset": true,\n  "Vehicles": [...],\n  "Event": {...}\n}
    WS -> Frontend : onmessage event
    Frontend -> Frontend : Nettoyer véhicules\nCréer nouveaux meshes
    Frontend -> Browser : Rendu nouveaux véhicules
    Browser -> User : Afficher nouvel état
end

loop Toutes les 30 secondes
    Backend -> WS : Ping (heartbeat)
    WS -> Frontend : Pong
    Frontend -> WS : Pong response
    WS -> Backend : Confirm alive
end

loop 60 FPS (Animation Continue)
    Frontend -> Frontend : requestAnimationFrame():\n- updateVehiclesPhysics()\n- checkCollisions()\n- renderer.render()
    Frontend -> Browser : Nouveau frame Canvas
    Browser -> User : Animation fluide
end

== Actions Utilisateur ==

User -> Browser : Clic bouton "Pause"
Browser -> Frontend : onClick event
Frontend -> Frontend : pauseRef.current = true\nArrêter loop animation
Frontend -> Browser : Mettre à jour bouton\n"Pause" → "Play"

User -> Browser : Sélectionner nouvelle carte\n(ex: "Desert")
Browser -> Frontend : onClick event
Frontend -> Frontend : setIsLoading(true)
Frontend -> Browser : Afficher LoadingScreen
Frontend -> Frontend : Nettoyer géométries:\nremoveMap()\nremoveVehicles()
Frontend -> Frontend : buildDesertIntersection()
Frontend -> Frontend : setIsLoading(false)
Frontend -> Browser : Masquer LoadingScreen\nAfficher nouvelle carte
Browser -> User : Carte désert visible

User -> Browser : Déplacer souris\n(Contrôle caméra)
Browser -> Frontend : onMouseMove event
Frontend -> Frontend : Mettre à jour\nCamera.position\nCamera.rotation
Frontend -> Browser : Rendu avec nouveau\nangle de vue
Browser -> User : Vue 3D modifiée

== Déconnexion ==

User -> Browser : Fermer onglet/navigateur
Browser -> Frontend : beforeunload event
Frontend -> WS : ws.close()
WS -> Backend : Client déconnecté
Backend -> Backend : Retirer client de la liste\nNettoyer ressources
deactivate Backend
deactivate WS
deactivate Frontend
deactivate Browser

@enduml
```

---

## 7. Diagramme de Flux de Déploiement (Netlify, Render, GitHub Actions)

Ce diagramme montre le flux de déploiement automatique du code vers les plateformes de production.

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam shadowing false

title Flux de Déploiement - CI/CD Pipeline

actor Développeur
participant "Git Local" as Git
participant "GitHub\nRepository" as GitHub
participant "GitHub\nActions" as Actions
participant "Netlify" as Netlify
participant "Render" as Render

== Développement ==

Développeur -> Git : git add .
Développeur -> Git : git commit -m "feature"
Développeur -> GitHub : git push origin master
activate GitHub

== Déploiement Automatique ==

GitHub -> Netlify : Webhook: Code mis à jour
activate Netlify
Netlify -> Netlify : npm install
Netlify -> Netlify : npm run build
Netlify -> Netlify : Déployer sur CDN
Netlify --> GitHub : ✓ Déployé
deactivate Netlify

GitHub -> Render : Webhook: Code mis à jour
activate Render
Render -> Render : pip install -r requirements.txt
Render -> Render : python traffic.py
Render -> Render : Serveur démarré
Render --> GitHub : ✓ Déployé
deactivate Render

== Maintien Actif (Keep-Alive) ==

GitHub -> Actions : Cron: Toutes les 14 minutes
activate Actions
Actions -> Render : HTTP GET /healthz
Render --> Actions : 200 OK
deactivate Actions

note right of Actions
  GitHub Actions envoie
  des pings réguliers pour
  éviter la mise en veille
  du serveur Render
end note

== Application en Production ==

Développeur -> Netlify : Vérifier le déploiement
Netlify --> Développeur : ✓ Frontend accessible
Développeur -> Render : Vérifier le serveur
Render --> Développeur : ✓ Backend actif

deactivate GitHub

@enduml
```

### Version Simplifiée (ASCII)

```
┌─────────────┐
│ Développeur │
└──────┬──────┘
       │ git push
       ▼
┌─────────────────────┐
│  GitHub Repository  │
└──────┬──────┬───────┘
       │      │
       │      │ Webhook
       │      ▼
       │  ┌────────────┐      npm run build
       │  │  Netlify   ├──────────────────► Frontend déployé
       │  └────────────┘                    (CDN Global)
       │
       │  ┌────────────┐      python traffic.py
       ├──┤   Render   ├──────────────────► Backend déployé
       │  └─────▲──────┘                    (Serveur WebSocket)
       │        │
       │        │ HTTP GET /healthz
       │        │ (toutes les 14 min)
       │  ┌─────┴──────┐
       └──┤  GitHub    │
          │  Actions   │
          │ (Keep-Alive)│
          └────────────┘
```

---

---

## 7. Diagramme de Flux de Déploiement (Netlify, Render, GitHub Actions)

Ce diagramme montre le flux de déploiement automatique du code vers les plateformes de production.

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam shadowing false

title Flux de Déploiement - CI/CD Pipeline

actor Développeur
participant "Git Local" as Git
participant "GitHub\nRepository" as GitHub
participant "GitHub\nActions" as Actions
participant "Netlify" as Netlify
participant "Render" as Render

== Développement ==

Développeur -> Git : git add .
Développeur -> Git : git commit -m "feature"
Développeur -> GitHub : git push origin master
activate GitHub

== Déploiement Automatique ==

GitHub -> Netlify : Webhook: Code mis à jour
activate Netlify
Netlify -> Netlify : npm install
Netlify -> Netlify : npm run build
Netlify -> Netlify : Déployer sur CDN
Netlify --> GitHub : ✓ Déployé
deactivate Netlify

GitHub -> Render : Webhook: Code mis à jour
activate Render
Render -> Render : pip install -r requirements.txt
Render -> Render : python traffic.py
Render -> Render : Serveur démarré
Render --> GitHub : ✓ Déployé
deactivate Render

== Maintien Actif (Keep-Alive) ==

GitHub -> Actions : Cron: Toutes les 14 minutes
activate Actions
Actions -> Render : HTTP GET /healthz
Render --> Actions : 200 OK
deactivate Actions

note right of Actions
  GitHub Actions envoie
  des pings réguliers pour
  éviter la mise en veille
  du serveur Render
end note

== Application en Production ==

Développeur -> Netlify : Vérifier le déploiement
Netlify --> Développeur : ✓ Frontend accessible
Développeur -> Render : Vérifier le serveur
Render --> Développeur : ✓ Backend actif

deactivate GitHub

@enduml
```

### Version Simplifiée (ASCII)

```
┌─────────────┐
│ Développeur │
└──────┬──────┘
       │ git push
       ▼
┌─────────────────────┐
│  GitHub Repository  │
└──────┬──────┬───────┘
       │      │
       │      │ Webhook
       │      ▼
       │  ┌────────────┐      npm run build
       │  │  Netlify   ├──────────────────► Frontend déployé
       │  └────────────┘                    (CDN Global)
       │
       │  ┌────────────┐      python traffic.py
       ├──┤   Render   ├──────────────────► Backend déployé
       │  └─────▲──────┘                    (Serveur WebSocket)
       │        │
       │        │ HTTP GET /healthz
       │        │ (toutes les 14 min)
       │  ┌─────┴──────┐
       └──┤  GitHub    │
          │  Actions   │
          │ (Keep-Alive)│
          └────────────┘
```

---

### Version Alternative (Diagramme d'Activité PlantUML)

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam shadowing false

title Système de Simulation - Diagramme d'Activité

start

:GitHub Actions\nCron Job Démarre;
note right
  Toutes les 14 minutes
end note

fork
  :Envoyer GET /healthz;
  :Serveur Backend répond 200 OK;
fork again
  partition "Backend (Render)" {
    :Mise à jour des minuteries\n(Toutes les 0.1s);
    
    if (Transition de feu ?) then (oui)
      :VERT → JAUNE → ROUGE;
      :Broadcast état via WebSocket;
    else (non)
      :Continuer;
    endif
    
    if (60 secondes écoulées ?) then (oui)
      :Générer nouveaux véhicules;
      :Choisir nouvel événement;
      :Broadcast complet (Reset);
    else (non)
      :Continuer;
    endif
  }
fork again
  partition "Frontend (Netlify)" {
    :Utilisateur accède à l'app;
    :Charger React + Three.js;
    :Établir connexion WebSocket;
    
    if (Connexion réussie ?) then (oui)
      :Initialiser scène 3D;
      :Créer feux de circulation;
      :Créer véhicules;
      
      fork
        :Recevoir états WebSocket;
        :Mettre à jour rendu 3D;
      fork again
        :Boucle Animation 60 FPS;
        :updateVehiclesPhysics();
        :checkCollisions();
        :renderer.render();
      end fork
      
      repeat
        :Utilisateur interagit;
        
        if (Action ?) then (Pause)
          :Arrêter animation;
        elseif (Changer carte) then (Nouvelle carte)
          :Afficher LoadingScreen;
          :Reconstruire carte 3D;
          :Masquer LoadingScreen;
        elseif (Contrôle caméra) then (Déplacer vue)
          :Mettre à jour Camera;
        endif
      repeat while (Session active ?) is (oui)
      ->non;
      
      :Fermer WebSocket;
      :Nettoyer ressources;
      
    else (non)
      :Afficher erreur connexion;
    endif
  }
end fork

stop

@enduml
```

### Version Alternative (Diagramme de Classes PlantUML)

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam classAttributeIconSize 0
skinparam shadowing false

title Système de Simulation - Diagramme de Classes Simplifié

package "Backend (Python)" {
  class TrafficLightController {
    - lights: Dict[str, str]
    - timers: Dict[str, float]
    + update_timers(delta: float): void
    + check_transition(): void
    + get_state(): Dict
  }
  
  class TrafficSimulator {
    - vehicle_id_counter: int
    - current_event: Dict
    + generate_vehicles(): List[Dict]
    + choose_event(): Dict
    + apply_event_flow(): float
    + get_full_state(): Dict
  }
  
  class WebSocketServer {
    - clients: Set[WebSocket]
    - rate_limit_store: Dict
    + validate_origin(request): bool
    + check_rate_limit(ip: str): bool
    + handle_client(ws: WebSocket): void
    + broadcast_state(state: Dict): void
  }
  
  TrafficSimulator --> TrafficLightController : utilise
  WebSocketServer --> TrafficSimulator : obtient état
}

package "Frontend (JavaScript/React)" {
  class ThreeScene {
    - wsRef: WebSocket
    - sceneRef: THREE.Scene
    - vehiclesRef: Map
    - lightsRef: Map
    + connectWebSocket(): void
    + handleMessage(data: JSON): void
    + animate(): void
  }
  
  class MapBuilders {
    + buildSimpleIntersection(scene): void
    + buildRainyIntersection(scene): void
    + buildDesertIntersection(scene): void
    + buildSnowyIntersection(scene): void
    + buildCityGrid(scene): void
  }
  
  class TrafficLights {
    + buildTrafficLights(scene, sens): Mesh
    + updateTrafficLights(lights, data): void
    + createTimerCanvas(seconds): Canvas
  }
  
  class VehiclePhysics {
    + updateVehiclesPhysics(vehicles, lights, delta): void
    + checkCollisions(vehicles): int
    + handleTurnState(vehicle): void
  }
  
  class HUD {
    + connectionStatus: string
    + isPaused: boolean
    + collisionCount: number
    + currentEvent: object
    + render(): JSX
  }
  
  class MapSidebar {
    + selectedMap: string
    + onMapChange(mapName): void
    + render(): JSX
  }
  
  class LoadingScreen {
    + isLoading: boolean
    + progress: number
    + render(): JSX
  }
  
  ThreeScene --> MapBuilders : utilise
  ThreeScene --> TrafficLights : utilise
  ThreeScene --> VehiclePhysics : utilise
  ThreeScene --> HUD : affiche
  ThreeScene --> MapSidebar : affiche
  ThreeScene --> LoadingScreen : affiche
}

package "Communication" {
  class WebSocket <<protocol>> {
    + send(data: string): void
    + close(): void
    + onmessage(event): void
    + onerror(event): void
  }
}

WebSocketServer ..> WebSocket : envoie JSON
WebSocket <.. ThreeScene : reçoit JSON

package "External Libraries" {
  class THREE.Scene {
    + add(object): void
    + remove(object): void
  }
  
  class THREE.WebGLRenderer {
    + render(scene, camera): void
  }
  
  class React {
    + useState()
    + useEffect()
    + useRef()
  }
  
  ThreeScene --> THREE.Scene : crée/gère
  ThreeScene --> THREE.WebGLRenderer : utilise
  ThreeScene --> React : hooks
}

@enduml
```


---

## Notes d'Utilisation

### Pour Visualiser ces Diagrammes :

#### Diagrammes Mermaid (Diagrammes 1 et 2)
1. **VS Code** : Installer l'extension "Markdown Preview Mermaid Support"
2. **GitHub** : Les diagrammes Mermaid s'affichent automatiquement
3. **Éditeurs en ligne** :
   - https://mermaid.live/
   - https://mermaid-js.github.io/mermaid-live-editor/

#### Diagrammes PlantUML (Diagramme 3)
1. **VS Code** : Installer l'extension "PlantUML"
2. **En ligne** :
   - http://www.plantuml.com/plantuml/uml/
   - https://plantuml-editor.kkeisuke.com/
3. **Export** : Les diagrammes PlantUML peuvent être exportés en PNG, SVG, ou PDF

### Pour Intégrer dans LaTeX :

1. **Exporter les diagrammes en images** :
   - Mermaid : Aller sur https://mermaid.live/, coller le code, cliquer "Export as PNG/SVG"
   - PlantUML : Copier le code dans http://www.plantuml.com/plantuml/, télécharger l'image

2. **Créer un dossier `diagrams/`** dans votre projet :
   ```
   projet_sem_pythob/
   ├── diagrams/
   │   ├── workflow_global.png
   │   ├── architecture_frontend.png
   │   └── diagramme_sequence.png
   ```

3. **Remplacer les placeholders dans le LaTeX** :
   ```latex
   \begin{figure}[H]
       \centering
       \includegraphics[width=\textwidth]{diagrams/workflow_global.png}
       \caption{Workflow global du système}
   \end{figure}
   ```

### Commandes LaTeX pour les Diagrammes

```latex
% Dans le préambule, assurez-vous d'avoir :
\usepackage{graphicx}
\usepackage{float}

% Pour un diagramme pleine largeur :
\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diagrams/nom_diagramme.png}
    \caption{Description du diagramme}
    \label{fig:nom_diagramme}
\end{figure}

% Pour un diagramme avec largeur personnalisée :
\begin{figure}[H]
    \centering
    \includegraphics[width=0.8\textwidth]{diagrams/nom_diagramme.png}
    \caption{Description du diagramme}
\end{figure}

% Pour référencer le diagramme dans le texte :
Comme illustré dans la figure \ref{fig:nom_diagramme}...
```

### Personnalisation

#### Couleurs Mermaid
Vous pouvez personnaliser les couleurs des diagrammes Mermaid en ajoutant :
```mermaid
%%{init: {'theme':'base', 'themeVariables': { 
  'primaryColor':'#61dafb',
  'primaryTextColor':'#000',
  'primaryBorderColor':'#000',
  'lineColor':'#F8B229',
  'secondaryColor':'#006100',
  'tertiaryColor':'#fff'
}}}%%
```

#### Styles PlantUML
Vous pouvez modifier les styles dans PlantUML :
```plantuml
skinparam backgroundColor #FFFFFF
skinparam sequenceArrowColor #3776ab
skinparam sequenceParticipantBackgroundColor #61dafb
skinparam shadowing false
```

---

## Correspondance avec le Rapport LaTeX

Les diagrammes correspondent aux sections suivantes du rapport :

| Diagramme | Section LaTeX | Placeholder à remplacer |
|-----------|---------------|-------------------------|
| **1. Workflow Global** | Chapitre 2, Section 2.3 (Architecture Globale) | `DIAGRAMME D'ARCHITECTURE GLOBALE` |
| **2. Architecture Frontend** | Chapitre 3, Section 3.1 (Architecture Détaillée) | `DIAGRAMME DE COMPOSANTS FRONTEND` |
| **3. Architecture Backend Python** | Chapitre 3, Section 3.1 (Architecture Détaillée - Backend) | Nouveau diagramme à ajouter |
| **4. Diagramme de Déploiement** | Chapitre 3, Section 3.4 (Déploiement) | `DIAGRAMME DE DÉPLOIEMENT` |
| **5. Diagramme de Séquence UML** | Chapitre 3, Section 3.1 (Architecture Détaillée) | `DIAGRAMME DE SÉQUENCE` |
| **6. Diagramme de Séquence (Simplifié)** | Chapitre 3, Section 3.1 (Architecture Détaillée) | `DIAGRAMME DE SÉQUENCE` |
| **7. Flux de Déploiement CI/CD** | Chapitre 3, Section 3.4 (Déploiement) | Nouveau diagramme à ajouter |

---

## Références

- **Frontend** : https://iteam-traffic-light.netlify.app
- **Backend** : https://traffic-light-ugoe.onrender.com
- **Repository** : https://github.com/Yassine-Frigui/Traffic-light
- **Documentation Mermaid** : https://mermaid.js.org/
- **Documentation PlantUML** : https://plantuml.com/

