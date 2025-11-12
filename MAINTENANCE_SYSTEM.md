# 🚛 Vehicle Preventive Maintenance System - MTM Enterprise

## 📋 Project Overview

A comprehensive vehicle maintenance tracking system for fleet management with preventive maintenance scheduling, document expiry tracking, and messaging notifications through SMS/WhatsApp/Facebook Messenger/Viber.

**Status:** 🟡 Planning Phase → 🔄 Development Phase Started
**Start Date:** November 11, 2025
**Estimated Completion:** TBD

## 🎯 Core Features

### ✅ **Completed Features**
- [x] **System Architecture Design** - Complete maintenance system blueprint
- [x] **Database Schema Design** - All required tables defined
- [x] **Notification Strategy** - Messaging apps instead of email
- [x] **UI/UX Design** - Desktop and mobile layouts planned
- [x] **Project Documentation** - This interactive MD file created

### 🚧 **In Development**
- [ ] **Database Implementation** - Tables and relationships
- [ ] **Backend API** - Maintenance scheduling and notifications
- [ ] **Frontend Components** - Maintenance dashboard and forms
- [ ] **Messaging Integration** - SMS/WhatsApp/Facebook/Viber APIs

### 📋 **Planned Features**
- [ ] **Custom Notification Periods** - Per maintenance type
- [ ] **Document Management** - File uploads and storage
- [ ] **Bulk Operations** - Fleet-wide maintenance management
- [ ] **Analytics Dashboard** - Maintenance cost and compliance tracking

## 🏗️ System Architecture

### **Database Schema**

#### `maintenance_schedules`
```sql
- id (PK)
- vehicle_id (FK to vehicles)
- maintenance_type (oil_change, brake_inspect, registration, insurance, etc.)
- category (preventive, documentation, safety)
- schedule_type (time_based, mileage_based, document_based)
- frequency_value (30 for monthly, 5000 for 5k km)
- frequency_unit (days, weeks, months, years, km, miles)
- reminder_days (customizable: 3, 7, 14, 30, etc.)
- last_completed_date
- next_due_date
- next_due_mileage
- status (active, paused, completed)
- created_at, updated_at
```

#### `vehicle_documents`
```sql
- id (PK)
- vehicle_id (FK)
- document_type (registration, insurance, permit, etc.)
- document_number
- issue_date
- expiry_date
- issuing_authority
- cost
- document_file_path
- reminder_sent (boolean)
- created_at, updated_at
```

#### `notification_preferences`
```sql
- id (PK)
- user_id (FK)
- maintenance_type (specific type or 'all')
- reminder_days (default reminder period)
- notification_methods (JSON: ['sms', 'whatsapp', 'in_app', 'push'])
- is_active (boolean)
- created_at, updated_at
```

#### `notification_history`
```sql
- id (PK)
- vehicle_id (FK)
- maintenance_schedule_id (FK)
- notification_type (reminder, overdue, completed)
- sent_at
- delivery_method (sms, whatsapp, facebook, viber, in_app, push)
- status (sent, failed, pending)
- created_at
```

#### `user_contacts`
```sql
- id (PK)
- user_id (FK)
- contact_type (phone, whatsapp, facebook, viber)
- contact_value (phone number, messenger ID, etc.)
- is_primary (boolean)
- verified (boolean)
- last_used
- created_at, updated_at
```

### **Maintenance Types & Schedules**

#### **Time-Based Schedules**
- **Daily**: Pre-trip inspections, fluid checks
- **Weekly**: Basic maintenance, tire pressure
- **Monthly**: Oil changes, filter checks, brake inspections
- **Quarterly**: Comprehensive inspections, transmission service
- **Semi-Annual**: Major services, safety systems
- **Annual**: Full vehicle inspection, emissions testing
- **Custom**: User-defined periods (6 months, 18 months, 2 years)

#### **Mileage-Based Schedules**
- **5,000 km**: Oil/filter changes, basic checks
- **10,000 km**: Brake inspections, tire rotations
- **25,000 km**: Major services, transmission fluid
- **50,000 km**: Engine overhaul prep, suspension checks
- **100,000 km**: Major component replacements

#### **Documentation Schedules**
- **Registration**: User-defined periods (1 year, 18 months, etc.)
- **Insurance**: Typically annual, but customizable
- **Road Tax**: Regional requirements
- **Emission Certificates**: Pollution control testing
- **Fitness Certificates**: Vehicle safety inspections
- **Special Permits**: Business-specific licenses

## 📱 Notification System

### **Messaging Platforms**
- **📱 SMS/Text Messages**: Universal reach, works everywhere
- **💬 WhatsApp**: Popular, free business messaging
- **📘 Facebook Messenger**: Business communications
- **💜 Viber**: Alternative messaging platform
- **📱 In-App Notifications**: Primary notification method
- **🔔 Push Notifications**: Mobile app alerts

### **Customizable Reminder Periods**
```
Oil Change: 7 days before
Brake Inspection: 3 days before
Registration: 30 days before
Insurance: 14 days before
Road Tax: 21 days before
Emission Cert: 10 days before
```

### **Priority-Based Alerts**
- **🔴 Critical**: Registration, Insurance (legal requirements)
- **🟠 High**: Brake inspections, major services
- **🟡 Medium**: Regular maintenance (oil, filters)
- **🟢 Low**: Minor services, documentation

## 🎨 UI/UX Design

### **Desktop Dashboard**
```
┌─ Maintenance Dashboard ──────────────────────────────┐
│ 🔧 VEHICLE MAINTENANCE TRACKER                        │
│                                                     │
│ ┌─ Quick Stats ──────────────────────────────────┐ │
│ │ 📊 Total Vehicles: 15                           │ │
│ │ ⚠️ Due Soon: 3                                  │ │
│ │ 🚨 Overdue: 1                                   │ │
│ │ ✅ Completed (This Month): 8                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ Vehicle Maintenance Grid ──────────────────────┐ │
│ │ Vehicle │ Last Service │ Next Due │ Status     │ │
│ │ ABC-123 │ Oil Change   │ Dec 15   │ Due Soon   │ │
│ │ DEF-456 │ Brake Insp   │ Dec 20   │ Scheduled  │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### **Mobile Dashboard**
```
┌─ Maintenance ──────────────────┐
│ ⚙️ Settings                      │
│                                 │
│ ┌─ Alerts ──────────────────┐   │
│ │ ⚠️ 3 services due soon    │   │
│ │ 🚨 1 service overdue      │   │
│ └───────────────────────────┘   │
│                                 │
│ ┌─ Vehicle: ABC-123 ────────┐   │
│ │ 🔧 Oil Change             │   │
│ │ Due: Dec 15 (3 days)      │   │
│ │ Status: Due Soon          │   │
│ │ [Mark Complete] [Snooze]  │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

## 📊 Implementation Phases

### **Phase 1: Database Infrastructure** ✅ *Completed*
- [x] Create maintenance_schedules table
- [x] Create vehicle_documents table
- [x] Create notification_preferences table
- [x] Create notification_history table
- [x] Create user_contacts table
- [x] Add database migrations
- [x] Create optimized indexes for all tables

### **Phase 2: Backend API Development** 🔄 *In Progress*
- [x] **Create RESTful API endpoints** - Full CRUD operations for all maintenance entities ✅
- [x] **Implement maintenance scheduling logic** - Automatic next due date calculations ✅
- [x] **Create notification scheduling system** - Dashboard with upcoming maintenance alerts ✅
- [ ] Build messaging API integrations (SMS/WhatsApp/Facebook/Viber)
- [ ] Add maintenance history tracking

### **Phase 3: Frontend UI Development**
- [ ] Create Maintenance.vue component
- [ ] Build maintenance dashboard
- [ ] Implement scheduling forms
- [ ] Create document management interface
- [ ] Build notification preferences UI

### **Phase 4: Notification System**
- [ ] Implement customizable reminder periods
- [ ] Create message templates
- [ ] Build contact management system
- [ ] Add delivery tracking and analytics

### **Phase 5: Advanced Features**
- [ ] Bulk operations for fleet management
- [ ] Maintenance analytics and reporting
- [ ] Automated scheduling templates
- [ ] Cost tracking and ROI calculations

## 🔧 Technical Implementation

### **Backend Technologies**
- **Database**: SQLite (existing)
- **API**: Node.js/Express (existing)
- **Messaging APIs**:
  - Twilio (SMS)
  - WhatsApp Business API
  - Facebook Messenger API
  - Viber API

### **Frontend Technologies**
- **Framework**: Vue 3 + Vuetify (existing)
- **State Management**: Vue Composition API
- **File Upload**: For document management
- **Real-time Updates**: WebSocket or polling

### **Security Considerations**
- **API Authentication**: JWT tokens (existing)
- **File Storage**: Secure document storage
- **Contact Privacy**: Encrypted contact information
- **Audit Logging**: Complete maintenance history

## 📈 Success Metrics

- **Maintenance Compliance**: % of services completed on time
- **Cost Savings**: Reduced breakdown incidents
- **Notification Effectiveness**: Response rate to alerts
- **User Adoption**: Fleet managers using the system regularly

## 🚀 Development Progress

### **Phase 1: Database Infrastructure** ✅ *Completed - November 11, 2025*

**✅ Completed Tasks:**
1. **Create maintenance_schedules table** - Core scheduling functionality ✅
2. **Create vehicle_documents table** - Document expiry tracking ✅
3. **Create notification_preferences table** - User notification settings ✅
4. **Create notification_history table** - Audit trail for notifications ✅
5. **Create user_contacts table** - Messaging contact information ✅
6. **Add database migrations** - Update existing migration scripts ✅
7. **Create optimized indexes** - Performance optimization for all tables ✅

**Database Status:** 🟢 All tables created and indexed successfully

---

### **Phase 2: Backend API Development** 🔄 *In Progress - November 11, 2025*

**✅ Completed Tasks:**
1. **Create RESTful API endpoints** - Full CRUD operations for all maintenance entities ✅
2. **Implement maintenance scheduling logic** - Automatic next due date calculations ✅
3. **Create notification scheduling system** - Dashboard with upcoming maintenance alerts ✅

**🔄 In Progress:**
4. **Build messaging API integrations** - SMS/WhatsApp/Facebook/Viber setup
5. **Add maintenance history tracking** - Complete audit trail

**API Endpoints Status:** 🟢 All endpoints implemented and tested
- **Maintenance Schedules**: `/api/maintenance/schedules` - Full CRUD with filtering
- **Vehicle Documents**: `/api/maintenance/documents` - Document management
- **Notification Preferences**: `/api/maintenance/notifications/preferences` - Settings management
- **Notification History**: `/api/maintenance/notifications/history` - Audit trail
- **User Contacts**: `/api/maintenance/contacts` - Messaging contacts
- **Dashboard**: `/api/maintenance/dashboard` - Statistics and alerts

---

### **Phase 3: Frontend UI Development** 🔄 *Next Phase*

**Planned Tasks:**
1. **Create Maintenance.vue component** - Desktop and mobile layouts
2. **Build maintenance dashboard** - Status overview with charts
3. **Implement scheduling forms** - Add/edit maintenance schedules
4. **Create document management interface** - Upload and track documents
5. **Build notification preferences UI** - Configure alert settings

---

**Last Updated:** November 11, 2025
**Current Phase:** Phase 2 - Backend API Development (Major Progress)
**Next Update:** After Phase 2 completion
