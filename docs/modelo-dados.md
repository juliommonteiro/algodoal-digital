# Modelo de dados

> Entrega da S2. Derivado das entidades do PRD (seção 20). Deve ser revisado depois da validação em campo (S4) — é normal surgirem campos novos.

## Diagrama ER

```mermaid
erDiagram
    users ||--o| carriers : "é (perfil carroceiro)"
    users ||--o{ businesses : "administra (parceiro)"
    categories ||--o{ categories : "subcategoria"
    categories ||--o{ places : classifica
    places ||--o| businesses : "detalhes comerciais"
    places ||--o{ place_photos : tem
    places ||--o{ qr_codes : "tem ponto de validação"

    users ||--o{ ride_requests : solicita
    carriers ||--o{ ride_requests : atende

    missions ||--o{ qr_codes : "validada por"
    users ||--o{ environmental_actions : registra
    missions ||--o{ environmental_actions : "referente a"
    qr_codes ||--o{ environmental_actions : "escaneado em"

    users ||--o{ checkins : faz
    places ||--o{ checkins : recebe

    users ||--o{ points_transactions : acumula
    businesses ||--o{ rewards : oferece
    rewards ||--o{ reward_redemptions : resgatada
    users ||--o{ reward_redemptions : resgata

    badges ||--o{ user_badges : concedida
    users ||--o{ user_badges : conquista

    users ||--o{ sync_events : envia

    users {
        uuid id PK
        text name
        text email UK
        text phone
        text password_hash
        user_role role
        bool is_active
        timestamptz created_at
    }
    categories {
        uuid id PK
        uuid parent_id FK
        text slug UK
        text name
        text icon
        int sort_order
    }
    places {
        uuid id PK
        uuid category_id FK
        place_kind kind
        text name
        text description
        numeric latitude
        numeric longitude
        bool is_published
        timestamptz updated_at
        timestamptz deleted_at
    }
    businesses {
        uuid id PK
        uuid place_id FK,UK
        uuid owner_id FK
        text whatsapp
        text phone
        jsonb opening_hours
        text price_range
        jsonb services
        bool is_partner
    }
    place_photos {
        uuid id PK
        uuid place_id FK
        text storage_key
        int position
    }
    carriers {
        uuid id PK
        uuid user_id FK,UK
        text display_name
        text whatsapp
        int capacity
        bool is_available
        bool is_approved
    }
    ride_requests {
        uuid id PK
        uuid tourist_id FK
        uuid carrier_id FK
        text origin
        text destination
        int passengers
        timestamptz pickup_at
        text notes
        ride_status status
        timestamptz responded_at
        timestamptz created_at
    }
    missions {
        uuid id PK
        text title
        text description
        int points
        mission_type type
        bool requires_qr
        int daily_limit
        bool is_active
    }
    qr_codes {
        uuid id PK
        uuid place_id FK
        uuid mission_id FK
        text token UK
        bool is_active
    }
    environmental_actions {
        uuid id PK
        uuid client_uuid UK
        uuid user_id FK
        uuid mission_id FK
        uuid qr_code_id FK
        numeric latitude
        numeric longitude
        text evidence_key
        action_status status
        timestamptz occurred_at
        uuid validated_by FK
    }
    checkins {
        uuid id PK
        uuid client_uuid UK
        uuid user_id FK
        uuid place_id FK
        checkin_method method
        timestamptz occurred_at
    }
    points_transactions {
        uuid id PK
        uuid user_id FK
        int amount
        text source_type
        uuid source_id
        timestamptz created_at
    }
    rewards {
        uuid id PK
        uuid business_id FK
        text title
        text description
        int cost_points
        int stock
        bool is_active
    }
    reward_redemptions {
        uuid id PK
        uuid user_id FK
        uuid reward_id FK
        text code UK
        redemption_status status
        timestamptz created_at
    }
    badges {
        uuid id PK
        text slug UK
        text name
        text description
        jsonb criteria
    }
    user_badges {
        uuid user_id PK,FK
        uuid badge_id PK,FK
        timestamptz earned_at
    }
    sync_events {
        uuid id PK
        uuid client_uuid UK
        uuid user_id FK
        text event_type
        jsonb payload
        sync_status status
        text error
        timestamptz occurred_at
        timestamptz received_at
    }
```

## Enums

| Enum | Valores |
|---|---|
| `user_role` | `tourist`, `carrier`, `partner`, `admin` |
| `place_kind` | `beach`, `trail`, `tourist_point`, `experience`, `business`, `collection_point`, `culture` |
| `ride_status` | `pending`, `accepted`, `declined`, `cancelled`, `expired` |
| `mission_type` | `environmental`, `special` |
| `action_status` | `pending`, `validated`, `rejected` |
| `checkin_method` | `qr`, `location` |
| `redemption_status` | `issued`, `used`, `expired` |
| `sync_status` | `accepted`, `rejected` |

## Decisões e diferenças em relação ao PRD

- **`profiles` e `tourist_points` do PRD viraram outra coisa.** Dados comuns ficam em `users`; o que é específico do carroceiro em `carriers`; do comerciante em `businesses`. Praias, trilhas e pontos turísticos são `places` com `kind` diferente. Resultado: o mapa consulta **uma tabela** com filtro por categoria.
- **Categorias em árvore** (`parent_id`) reproduzem a hierarquia da seção 7 do PRD (Turismo → Praias, Alimentação → Restaurantes…).
- **`deleted_at` em `places`** (soft delete) é necessário para o pull do catálogo avisar ao celular que um local foi removido.
- **`client_uuid` com `UNIQUE`** em `checkins`, `environmental_actions` e `sync_events` garante que reenviar a Outbox não duplica pontos.
- **`points_transactions` é a fonte da verdade.** Saldo = `SUM(amount)`. Resgatar recompensa grava uma linha negativa. `source_type` + `source_id` apontam para o check-in, ação ou resgate que originou a linha.
- **`sync_events`** guarda o bruto de tudo que chegou pela Outbox, com o motivo de rejeição. É o log para depurar "meus pontos sumiram" durante o piloto.
- **Ranking** (épico 6 do PRD) não tem tabela: é uma consulta sobre `points_transactions`.
- **Horários** em `jsonb` (`{"seg": [["09:00","22:00"]], ...}`) evitam uma tabela extra que o MVP não precisa.

## Índices a criar desde o início

- `places (category_id)`, `places (updated_at)` — filtro do mapa e pull do catálogo
- `ride_requests (carrier_id, status)` — tela do carroceiro
- `points_transactions (user_id)` — saldo
- `checkins (user_id, place_id)` — passaporte

## Dados sensíveis (PRD, seção 24)

`users.phone`, `users.email`, coordenadas de `environmental_actions` e o histórico de `checkins` são dados pessoais (LGPD). Coordenadas só são gravadas quando a missão pede; nada de rastrear localização em segundo plano.
