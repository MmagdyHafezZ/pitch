# S3-Manager
## Overview
This microservice is responsible for managing S3 buckets and file operations.  
It plays a key role in the overall system by providing unified access to create, list, and delete buckets, as well as upload, download, list, and delete files within any configured bucket.  
All bucket configurations are dynamically loaded from environment variables, allowing flexible setup across environments.

## Features
- **Bucket Management:** Create, list, and delete S3 buckets as needed.
- **File Management:** Upload, download (via pre-signed URL), list, and delete files.
- **Dynamic Configuration:** Buckets and regions are configured using environment variables.
- **Repository Layer:** The `S3Repository` wraps AWS SDK interactions, keeping the code modular, testable, and easy to extend to other storage providers.
