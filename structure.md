.
├── .github
│   └── workflows
│       └── ci.yml
├── .gitignore
├── .pre-commit-config.yaml
├── .ruff_cache
├── README.md
├── backend
│   └── core
│       ├── README.md
│       ├── alembic
│       │   ├── README
│       │   ├── env.py
│       │   ├── script.py.mako
│       │   └── versions
│       │       ├── 0001_create_admin_tables.py
│       │       ├── 0002_create_compliance_tables.py
│       │       └── 0003_seed_master_frameworks.py
│       ├── alembic.ini
│       ├── app
│       │   ├── api
│       │   │   ├── deps.py
│       │   │   └── v1
│       │   │       ├── audit_log.py
│       │   │       ├── controls.py
│       │   │       ├── evidence.py
│       │   │       ├── frameworks.py
│       │   │       ├── onboard.py
│       │   │       ├── operators.py
│       │   │       └── users.py
│       │   ├── core
│       │   │   └── config.py
│       │   ├── db
│       │   │   ├── models.py
│       │   │   └── session.py
│       │   ├── main.py
│       │   ├── middleware
│       │   │   ├── audit.py
│       │   │   └── auth.py
│       │   ├── schemas
│       │   │   ├── controls.py
│       │   │   ├── evidence.py
│       │   │   ├── frameworks.py
│       │   │   ├── onboard.py
│       │   │   ├── operators.py
│       │   │   └── users.py
│       │   ├── seeds
│       │   │   ├── iso27001.json
│       │   │   └── iso27001_requirements.json
│       │   ├── services
│       │   │   ├── keycloak.py
│       │   │   └── storage.py
│       │   └── utils
│       │       └── crypto.py
│       └── requirements.txt
├── docker-compose.yml
├── frontend
├── init-db.sql
├── init-db.sql.template
├── realm-export.json
├── requirements.txt
└── scripts
    └── seed_dev_db.py
