# Brief: the Meridian Rail IT landscape

Draw one diagram of the IT landscape of a fictional rail operator, Meridian Rail: 70 services in 10 business domains, and the integrations between them. Use the content below as it is; do not add or drop services or connections. Whether and how the domains are drawn as groups, where things go, how big they are and how the landscape is laid out is yours to decide. Add a title text at the top. Leave out tags, highlights, the legend, notes and links: this is about the drawing.

## Services by business domain

### Ticketing & Booking (7)
- Fare Calculation Engine
- Seat Reservation Service
- Ticket Issuance API
- Booking Session Manager
- Promotions & Discounts Service
- Multi-leg Journey Planner
- Refund Processing Service

### Customer Experience (7)
- Customer Profile Service
- Loyalty Rewards Engine
- Mobile App Backend
- Customer Notifications Service
- Feedback & Survey Platform
- Accessibility Preferences Service
- Customer Support Ticketing

### Operations & Scheduling (7)
- Train Scheduling Engine
- Platform Assignment Service
- Real-time Delay Predictor
- Crew Rostering System
- Timetable Publishing Service
- Service Disruption Manager
- Capacity Planning Tool

### Fleet & Maintenance (7)
- Rolling Stock Inventory
- Predictive Maintenance Engine
- Maintenance Work Order System
- Fleet Telemetry Ingestion
- Parts & Inventory Management
- Depot Scheduling Service
- Vehicle Health Dashboard

### Finance & Billing (7)
- Revenue Recognition Engine
- Invoice Generation Service
- Payment Gateway Integration
- Fare Reconciliation Service
- Budget & Forecasting Tool
- Supplier Payments System
- Fraud Detection Service

### HR & Workforce (7)
- Employee Records System
- Shift Scheduling Service
- Payroll Processing Engine
- Recruitment Portal
- Training & Certification Tracker
- Employee Self-Service Portal
- Union Agreement Compliance Tool

### Safety & Compliance (7)
- Incident Reporting System
- Safety Audit Tracker
- Regulatory Filing Service
- Risk Register Platform
- Compliance Dashboard
- Emergency Response Coordinator
- Drug & Alcohol Testing Tracker

### Data & Analytics (7)
- Enterprise Data Warehouse
- Ridership Analytics Platform
- Real-time Data Pipeline
- Reporting & BI Portal
- Master Data Management Hub
- Data Quality Monitoring Service
- ML Forecasting Platform

### Corporate IT (7)
- Identity & Access Management
- Enterprise Service Bus
- Document Management System
- IT Service Desk Platform
- Network Monitoring Service
- Backup & Disaster Recovery
- Corporate Email & Collaboration

### Partner & Interline (7)
- Interline Ticketing Gateway
- Partner API Gateway
- Codeshare Settlement Service
- Cross-border Fare Interop
- Partner Data Exchange Hub
- Alliance Loyalty Bridge
- Third-party Booking Aggregator

## Connections (83, each with the label shown; no label where none is given)
- Incident Reporting System -> Enterprise Data Warehouse
- Partner API Gateway -> Enterprise Service Bus
- Employee Self-Service Portal -> Employee Records System
- Training & Certification Tracker -> Employee Records System
- Payroll Processing Engine -> Employee Records System
- Shift Scheduling Service -> Employee Records System
- Recruitment Portal -> Employee Records System
- Union Agreement Compliance Tool -> Employee Records System
- Safety Audit Tracker -> Compliance Dashboard
- Regulatory Filing Service -> Compliance Dashboard
- Risk Register Platform -> Compliance Dashboard
- Emergency Response Coordinator -> Incident Reporting System
- Incident Reporting System -> Safety Audit Tracker
- Data Quality Monitoring Service -> Master Data Management Hub
- ML Forecasting Platform -> Enterprise Data Warehouse
- Ridership Analytics Platform -> Enterprise Data Warehouse
- Real-time Data Pipeline -> Enterprise Data Warehouse
- Reporting & BI Portal -> Enterprise Data Warehouse
- Backup & Disaster Recovery -> Enterprise Data Warehouse
- Network Monitoring Service -> Enterprise Service Bus
- Corporate Email & Collaboration -> Identity & Access Management
- IT Service Desk Platform -> Identity & Access Management
- Document Management System -> Identity & Access Management
- Partner Data Exchange Hub -> Partner API Gateway
- Interline Ticketing Gateway -> Partner API Gateway
- Codeshare Settlement Service -> Partner API Gateway
- Fare Reconciliation Service -> Payment Gateway Integration
- Fraud Detection Service -> Payment Gateway Integration
- Invoice Generation Service -> Revenue Recognition Engine
- Budget & Forecasting Tool -> Revenue Recognition Engine
- Maintenance Work Order System -> Parts & Inventory Management
- Rolling Stock Inventory -> Fleet Telemetry Ingestion
- Maintenance Work Order System -> Predictive Maintenance Engine
- Depot Scheduling Service -> Maintenance Work Order System
- Depot Scheduling Service -> Train Scheduling Engine
- Timetable Publishing Service -> Train Scheduling Engine
- Service Disruption Manager -> Real-time Delay Predictor
- Capacity Planning Tool -> Train Scheduling Engine
- Platform Assignment Service -> Train Scheduling Engine
- Real-time Delay Predictor -> Train Scheduling Engine
- Train Scheduling Engine -> Enterprise Service Bus
- Feedback & Survey Platform -> Customer Profile Service
- Accessibility Preferences Service -> Customer Profile Service
- Customer Support Ticketing -> Customer Profile Service
- Mobile App Backend -> Customer Profile Service
- Loyalty Rewards Engine -> Customer Profile Service
- Alliance Loyalty Bridge -> Loyalty Rewards Engine
- Customer Notifications Service -> Customer Profile Service
- Service Disruption Manager -> Customer Notifications Service
- Customer Profile Service -> Master Data Management Hub
- Compliance Dashboard -> Enterprise Data Warehouse
- Master Data Management Hub -> Enterprise Data Warehouse
- Multi-leg Journey Planner -> Fare Calculation Engine
- Booking Session Manager -> Seat Reservation Service
- Cross-border Fare Interop -> Fare Calculation Engine
- Revenue Recognition Engine -> Enterprise Data Warehouse
- Fleet Telemetry Ingestion -> Enterprise Data Warehouse
- Customer Profile Service -> Enterprise Data Warehouse
- Enterprise Service Bus -> Identity & Access Management
- Payment Gateway Integration -> Identity & Access Management
- Mobile App Backend -> Identity & Access Management
- Partner API Gateway -> Identity & Access Management
- Crew Rostering System -> Train Scheduling Engine
- ML Forecasting Platform -> Ridership Analytics Platform
- Employee Records System -> Master Data Management Hub
- Employee Records System -> Identity & Access Management
- Shift Scheduling Service -> Crew Rostering System
- Ticket Issuance API -> Booking Session Manager
- Booking Session Manager -> Fare Calculation Engine
- Promotions & Discounts Service -> Fare Calculation Engine
- Multi-leg Journey Planner -> Train Scheduling Engine
- Third-party Booking Aggregator -> Ticket Issuance API
- Ticket Issuance API -> Payment Gateway Integration
- Ticket Issuance API -> Identity & Access Management
- Refund Processing Service -> Payment Gateway Integration
- Mobile App Backend -> Booking Session Manager
- Codeshare Settlement Service -> Payment Gateway Integration
- Predictive Maintenance Engine -> Fleet Telemetry Ingestion
- Vehicle Health Dashboard -> Fleet Telemetry Ingestion
- Drug & Alcohol Testing Tracker -> Employee Records System
- Fare Reconciliation Service -> Fare Calculation Engine
- Booking Session Manager -> Customer Profile Service
- Supplier Payments System -> Payment Gateway Integration

## Done means
- The diagram is saved as the file named in your instructions.
- Every service and connection above is in it, with the labels shown.
- Nothing overlaps, no label is hidden by the elements it joins, and nothing sticks out of its container.
- Finish by asking for the remaining layout problems (inspect_diagram with issues_only) and report them, even if there are none.
