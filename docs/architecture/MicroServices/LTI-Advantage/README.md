# LTI-Advantage

## Overview
This microservice is responsible for managing **LTI (Learning Tools Interoperability) 1.3 and LTI Advantage** integrations within the system.  
It plays a key role in enabling **secure communication** between our platform and external Learning Management Systems (LMS) 
The service handles **launch authentication**, **user role provisioning**, **deep linking**, and **grade synchronization**, ensuring a seamless learning experience and interoperability with external educational tools.

## Features
- **Secure LTI Launches:** Handles OAuth 2.0 and JWT-based authentication for initiating trusted connections between the LMS and our platform.  
- **Deep Linking Support:** Allows instructors to dynamically configure and embed specific tool content directly within their LMS courses.  
- **Grade Sync:** Manages Assignment and Grade Services for automatic grade reporting
- **Names and Roles Provisioning Services (NRPS):** Supports **roster synchronization**, allowing the platform to retrieve and update participant lists (students, instructors, TAs) from the LMS in real time.  
- **Role-Based Access Control:** Ensures that each user’s LMS role (e.g., Instructor, Learner, Admin) determines their permissions and visibility within the tool.  
- **Logging and Error Handling:** Tracks all LTI launch requests, authentication events, and grade sync operations for debugging and audit purposes.  

