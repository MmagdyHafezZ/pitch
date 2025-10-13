# LTI-Advantage

## Overview
This microservice is responsible for managing **Users**.  
The User Management Service provides centralized **authentication**, **authorization**, and **account handling** across the platform. It manages user identities, organization memberships, role-based access, subscription plans, and AI usage tracking.

## Features
- **User Authentication & Identity Management:**
    - Secure user registration, login, and token-based authentication.
    - Role-based access control (RBAC) and organization membership validation handled by User and Org modules.
- **Organization & Role Handling:**
    - Supports multi-organization structures with distinct user roles.
    - Maintains organization details, membership mappings, and permissions.
- **Plans & Subscriptions:**
    - Centralized plan definition and management.
    - Subscription lifecycle (creation, renewal, cancellation).
- **AI Usage Tracking:**
    - Tracks metered AI usage per user or organization.
    - Enables precise monitoring and reporting for billing and analytics.
