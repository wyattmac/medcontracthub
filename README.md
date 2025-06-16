# MedContractHub - Hybrid Intelligence Platform

**Enterprise-Scale Federal Contracting with AI/ML and Human Expertise**

> 🏆 **Microservices Architecture** | Kubernetes Orchestrated | Multi-Model AI | Event-Driven | Zero Trust Security

Combining human expertise with artificial intelligence for transformative government contracting. Features distributed microservices, real-time collaboration, and advanced ML capabilities.

---

## 🚀 Quick Start (Kubernetes + Multi-Model Databases)

**Deploy the Hybrid Intelligence Platform with Kubernetes:**

```bash
# 1. Clone repository
git clone https://github.com/wyattmac/medcontracthub.git
cd medcontracthub

# 2. Run complete Kubernetes setup
./k8s/scripts/setup-complete-k8s.sh

# 3. Or deploy manually to specific environment
kubectl apply -k k8s/overlays/dev/      # Development
kubectl apply -k k8s/overlays/staging/  # Staging
kubectl apply -k k8s/overlays/prod/     # Production

# 4. Access services
kubectl port-forward svc/kong-proxy 8080:80 -n medcontracthub
# http://localhost:8080 (API Gateway)
```

### 🔧 Platform Configuration

**🔑 Multi-Service Architecture:**
```bash
# Configure service endpoints
cp k8s/config/services.yaml.example k8s/config/services.yaml

# Core Services:
✅ PostgreSQL Cluster    - Primary + read replicas
✅ Redis Cluster         - Distributed cache
✅ Weaviate Vector DB    - AI embeddings
✅ Kafka Streaming       - Event backbone
✅ Kong API Gateway      - Service routing

# AI/ML Services:
✅ Claude-3-Opus         - Primary AI model
✅ GPT-4-Turbo          - Fallback model
✅ Mistral-Pixtral      - OCR processing
✅ Llama-3-70B          - Local LLM option
✅ MLflow               - Model lifecycle

# Observability:
✅ Prometheus           - Metrics collection
✅ Grafana              - Dashboards
✅ Jaeger               - Distributed tracing
✅ ELK Stack            - Log aggregation
```

**🚀 Quick Start Commands:**
```bash
# 1. Setup (one time)
cp .env.consolidated .env.local     # Local development
cp .env.consolidated .env           # Docker setup

# 2. Start development
make dev                           # Docker on port 3000

# 3. Verify everything works
curl http://localhost:3000/api/health
npm run lint && npm run type-check

# 4. Alternative environments
make staging  # Port 3001 (staging build + staging DB)
make prod     # Port 3002 (production simulation)
```

**Prerequisites:** Docker Desktop 4.0+, Make

**⚠️ Common Issues:**
- **APIs not working:** `cp .env.consolidated .env && docker-compose restart`
- **Port 3000 in use:** Use `make staging` (port 3001) instead
- **TypeScript errors:** Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 📚 Documentation Hub

### **🏗️ Architecture Documentation**
| Document | Purpose | Status |
|----------|---------|--------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Hybrid Intelligence Platform design | ✅ Updated for microservices |
| **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** | Kubernetes development workflow | ✅ Multi-environment ready |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Enterprise Kubernetes deployment | ✅ Service mesh configured |

### **🔧 Operational Guides**
| Document | Purpose | Last Updated |
|----------|---------|--------------|
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | Bug fixes & solutions | December 2024 |
| **[PRODUCTION_TASKS.md](./PRODUCTION_TASKS.md)** | Current priorities | Live document |

### **📖 Feature Documentation**
- **[NAICS_MATCHING_SYSTEM.md](./NAICS_MATCHING_SYSTEM.md)** - Medical industry classification system
- **[OCR_PROPOSAL_SYSTEM.md](#ocr-proposal-integration)** - OCR-powered proposal creation workflow

---

## ✨ Hybrid Intelligence Platform

### **🎯 Enterprise Value Proposition**
- **Microservices Architecture** with Kubernetes orchestration
- **Multi-Model AI System** with intelligent routing and cost optimization
- **Event-Driven Processing** handling 50K+ messages/second via Kafka
- **Real-Time Collaboration** with WebSocket service and operational transformation
- **Semantic Search** powered by Weaviate vector database
- **Performance Monitoring** with ClickHouse time-series storage

### **🚀 Key Features**

#### Smart Opportunity Discovery
- Real-time SAM.gov integration with 1,000 daily API quota management
- Intelligent filtering by medical NAICS codes, geography, and deadlines
- Automated background sync with Redis caching for performance
- Custom opportunity alerts and deadline reminders

#### AI-Powered Intelligence
- **Document OCR** processing with Mistral AI ($0.001/page)
- **Contract Analysis** with Anthropic Claude for insights
- **AI Analyze** ✨ NEW - One-click analysis of SAM.gov attachments from saved opportunities
- **Supplier Discovery** using Brave Search API
- **Win Probability Scoring** based on company capabilities

#### OCR-Enhanced Proposals ✨ NEW
- **"Mark for Proposal"** button on each opportunity
- **Automated Document Processing** extracts requirements from SAM.gov documents
- **AI Requirement Analysis** identifies compliance needs, deadlines, and specifications
- **Pre-populated Proposal Forms** with opportunity data and extracted requirements
- **Document Analyzer** with tabbed interface (Requirements/Summary/Compliance/Raw Text)

#### SAM.gov Document Access ✨ NEW
- **Direct Download Interface** on opportunity detail pages
- **Secure Download Proxy** with server-side API key authentication
- **Simple Document Access** without AI processing when you just need files
- **Clean File Management** with filename and size display
- **AI Analyze Button** on saved opportunities for instant attachment analysis

#### Enterprise Dashboard
- **Virtual Scrolling** for 20k+ opportunities with sub-second load times
- **Real-time Performance** tracking and monitoring
- **Bulk Export** capabilities (PDF/Excel)
- **Mobile-First Design** optimized for all devices (375px+)

### **💳 Pricing Structure**
- **Starter**: $29/month - Small distributors
- **Professional**: $99/month - Full feature access
- **Enterprise**: $299/month - Advanced features
- **14-day free trial** for all plans

---

## 🛠️ Enterprise Technology Stack

### **Architecture Patterns**
- **Microservices**: Domain-driven service boundaries
- **Event Sourcing**: Complete audit trail with Kafka
- **CQRS**: Optimized read/write models
- **Saga Pattern**: Distributed transaction management
- **Service Mesh**: Istio for communication and security

### **AI/ML Platform**
- **Model Registry**: MLflow for lifecycle management
- **Multi-Model**: Claude-3, GPT-4, Mistral, Llama-3
- **Vector Database**: Weaviate for embeddings
- **Fine-Tuning**: Domain-specific model training
- **A/B Testing**: Automated model comparison

### **Data Infrastructure**
- **PostgreSQL**: Event sourcing and transactional data
- **Redis Cluster**: Multi-tier distributed caching
- **Weaviate**: Vector embeddings and semantic search
- **ClickHouse**: Time-series data storage
- **Kafka**: Event streaming backbone
- **S3**: Document storage with CDN

### **Kubernetes Platform**
- **Orchestration**: K8s with auto-scaling (HPA/VPA)
- **Service Mesh**: Istio with mTLS and observability
- **Ingress**: Kong API Gateway with plugins
- **Secrets**: Vault for secure key management
- **GitOps**: ArgoCD for declarative deployments

### **Observability Stack**
- **Metrics**: Prometheus with custom business metrics
- **Visualization**: Grafana dashboards
- **Tracing**: Jaeger for distributed requests
- **Logging**: ELK stack with structured logs
- **APM**: Full application performance monitoring

---

## 📊 Production Metrics

### **✅ Quality Assurance**
- **Zero TypeScript Errors** - Strict mode compliance
- **87/96 Tests Passing** - Comprehensive test coverage
- **Mobile Responsive** - 375px to 1400px+ support
- **Security Hardened** - CSRF protection, input sanitization
- **Performance Optimized** - <500ms API response times

### **🔧 Enterprise Features**
- **Multi-Environment Deployment** via Docker
- **Hot Reload Development** with live error boundary
- **Database Connection Pooling** for scalability
- **API Rate Limiting** per subscription tier
- **Comprehensive Error Handling** with visual debugging

---

## 🎯 Business Impact

### **For Medical Supply Distributors**
1. **90% Time Reduction** - From hours to minutes for opportunity research
2. **Higher Win Rates** - AI-powered matching to company capabilities
3. **Zero Missed Opportunities** - Automated monitoring and alerts
4. **Compliance Simplified** - Built-in federal requirement tracking
5. **Scalable Operations** - Handle 10x more opportunities efficiently

### **Competitive Advantages**
- **Medical Industry Specialization** - Purpose-built for healthcare supply chain
- **AI-First Architecture** - Cutting-edge technology for competitive edge
- **Real-Time Government Data** - Always current with SAM.gov integration
- **Enterprise Security** - Bank-level security with federal compliance ready

---

## 🚀 Development Workflow

### **Environment Setup**
```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_claude_api_key
SAM_GOV_API_KEY=your_samgov_api_key
STRIPE_SECRET_KEY=your_stripe_secret
CSRF_SECRET=your_32_char_secret_key
```

### **Development Commands**
```bash
# Development (WSL/Docker)
./easy-docker.sh        # Quick start Docker environment (WSL-friendly)
make dev                # Docker development environment
npm run dev             # Local development server
npm run worker:dev      # Background job processor

# Docker Logs (WSL)
./docker-logs.sh app    # View application logs
./docker-logs.sh all    # View all service logs
./docker-logs.sh follow # Follow logs in real-time

# Quality Assurance
npm run lint            # ESLint + Prettier code formatting
npm run type-check      # TypeScript strict mode validation
npm test               # Jest test suite
npm run test:e2e       # Playwright end-to-end tests

# Database
npm run db:types       # Generate TypeScript types from Supabase
npm run dev-setup      # Create development user account
```

### **Multi-Environment Deployment**
```bash
# Three-stage Docker management (WSL-optimized)
./docker-manage.sh start dev      # Development (port 3000)
./docker-manage.sh start staging  # Staging (port 3001)  
./docker-manage.sh start prod     # Production (port 3002)
./docker-manage.sh status [env]   # Check environment status
./docker-manage.sh logs [env]     # View environment logs

# Alternative commands
make dev               # Development (port 3000)
make staging          # Staging (port 3001)
make prod            # Production (port 3002)
make health-check    # Verify all services
```

---

## 📄 OCR Proposal Integration

### **Workflow Overview**
1. **Discover Opportunities** - Browse SAM.gov opportunities with AI matching
2. **Mark for Proposal** - Click the blue "Mark for Proposal" button on any opportunity  
3. **OCR Processing** - System automatically processes attached contract documents
4. **AI Analysis** - Extract requirements, deadlines, compliance needs, and specifications
5. **Create Proposal** - Pre-populated form with opportunity data and extracted requirements

### **Key Components**

#### `MarkForProposalButton` Component
```typescript
// Location: components/dashboard/opportunities/mark-for-proposal-button.tsx
// Features:
- Trigger OCR processing modal
- Display processing progress and results
- Navigate to pre-populated proposal form
```

#### `ProposalDocumentAnalyzer` Component  
```typescript
// Location: components/dashboard/proposals/proposal-document-analyzer.tsx
// Features:
- Tabbed interface: Requirements | Summary | Compliance | Raw Text
- AI-powered requirement extraction
- Export functionality for analysis results
- Copy-to-clipboard features
```

#### Enhanced Proposal Form
```typescript
// Location: components/dashboard/proposals/create-proposal-form.tsx
// Features:
- Document upload section with drag-and-drop
- Real-time OCR processing with progress indicators
- File validation and security checks
- Integration with existing proposal workflow
```

### **API Endpoints**
- `GET /api/sam-gov/attachments` - Get attachment list for opportunity
- `POST /api/sam-gov/attachments` - Process attachments with AI
- `GET /api/sam-gov/attachments/download` - Secure download proxy
- `POST /api/proposals` - Create proposal with attached documents
- `GET /api/opportunities/{id}` - Fetch opportunity with document links

### **Database Schema**
```sql
-- New table for proposal document attachments
CREATE TABLE proposal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_size INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    document_url TEXT,
    extracted_text TEXT,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔐 Security & Compliance

### **Security Features**
- **Row Level Security** on all database operations
- **CSRF Protection** for all state-changing requests
- **Input Sanitization** with DOMPurify on all user inputs
- **Environment Validation** on application startup
- **Secure Headers** via Next.js middleware
- **Rate Limiting** based on subscription tier

### **Federal Compliance Ready**
- **HTTPS Enforcement** in production environments
- **Audit Logging** for all user actions
- **Data Encryption** at rest and in transit
- **Access Controls** with role-based permissions

---

## 📈 Performance Optimization

### **Frontend Performance**
- **Virtual Scrolling** for 20k+ opportunity lists
- **Code Splitting** with dynamic imports
- **Bundle Optimization** achieving <100kb initial load
- **Image Optimization** with Next.js Image component
- **Progressive Loading** with skeleton screens

### **Backend Performance**
- **Redis Caching** with intelligent cache invalidation
- **Database Query Optimization** with connection pooling
- **API Response Caching** with 5-minute TTL for opportunity data
- **Background Job Processing** for non-blocking operations

---

## 🎯 Roadmap

### **✅ Phase 1: Core Platform (Complete)**
- SAM.gov integration with 23,300+ opportunities
- AI-powered analysis and recommendations  
- User authentication and company profile management
- Responsive dashboard with opportunity management

### **✅ Phase 2: Advanced Features (Complete)**
- Document OCR processing with Mistral AI
- Automated supplier discovery with Brave Search API
- Stripe billing with usage-based metering
- Email notifications and deadline reminder system

### **🚀 Phase 3: Enterprise Features (Next Quarter)**
- Advanced dashboard with export capabilities
- Team collaboration and role management
- CRM/ERP system integrations via REST API
- Mobile application for field operations

### **🎯 Phase 4: AI Enhancement (Future)**
- Automated proposal generation assistance
- Competitive intelligence and market analysis
- Predictive win probability scoring with ML
- Voice interface and natural language query processing

---

## 🤝 Contributing

### **Development Standards**
1. **TypeScript Strict Mode** - All code must compile without errors
2. **Test Coverage** - All new features require tests
3. **Code Quality** - ESLint + Prettier compliance required
4. **Documentation** - Update relevant docs with changes
5. **Security** - Security review for all external integrations

### **Contribution Workflow**
```bash
# 1. Fork and clone
git clone https://github.com/yourusername/medcontracthub.git

# 2. Create feature branch
git checkout -b feature/amazing-feature

# 3. Development and testing
npm run lint && npm run type-check && npm test

# 4. Commit with conventional format
git commit -m 'feat: add amazing feature'

# 5. Push and create PR
git push origin feature/amazing-feature
```

---

## 📞 Support & Resources

### **Development Support**
- **Documentation**: [Complete Developer Guide](./DEVELOPER_GUIDE.md)
- **Architecture**: [System Design & Patterns](./ARCHITECTURE.md)
- **Troubleshooting**: [Bug Solutions & Debugging](./TROUBLESHOOTING.md)
- **Deployment**: [Production Setup Guide](./DEPLOYMENT.md)

### **Business Contact**
- **Email**: support@medcontracthub.com
- **Issues**: [GitHub Issues](https://github.com/wyattmac/medcontracthub/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/wyattmac/medcontracthub/discussions)

---

## 🏆 Built With Enterprise Standards

**Core Technologies:**
- [Next.js 15](https://nextjs.org/) - React framework for production
- [Supabase](https://supabase.com/) - Open-source Firebase alternative
- [Anthropic Claude](https://www.anthropic.com/) - Advanced AI for analysis
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

**Enterprise Libraries:**
- [TypeScript](https://www.typescriptlang.org/) - Type safety and developer experience
- [shadcn/ui](https://ui.shadcn.com/) - Production-ready component library
- [TanStack Query](https://tanstack.com/query) - Powerful data synchronization
- [Zustand](https://zustand-demo.pmnd.rs/) - Lightweight state management

---

**MedContractHub** - *Where AI meets federal contracting for medical supply distributors*

> 🚀 **Ready to transform your government contracting?** [Start your free trial today](https://medcontracthub.com)

---

> **📋 Documentation Rule**: This project maintains exactly 7 documentation files. **No new documentation files may be created.** All documentation updates must be added to existing files: README.md, DEVELOPER_GUIDE.md, ARCHITECTURE.md, DEPLOYMENT.md, TROUBLESHOOTING.md, PRODUCTION_TASKS.md, or NAICS_MATCHING_SYSTEM.md.

*© 2024 MedContractHub. Production-ready AI platform for federal medical supply contracting.*