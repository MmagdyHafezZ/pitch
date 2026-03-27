
# setup ibm cloud cli
ibmcloud resource groups;
ibmcloud target -g "Magdy Hafez Capstone Project"
ibmcloud ce project list     
ibmcloud ce project select --name pitch-main 


# Create backend env var secret
ibmcloud ce secret create --name pitch-env-var --from-env-file deployment/.cloud.env

# Delete backend env var secret
ibmcloud ce secret delete --name pitch-env-var 




# Create frontend deployment
ibmcloud ce application create \
  --name pitch-frontend-ym-test-10 \
  --build-source git@github.com:MmagdyHafezZ/pitch.git \
  --build-commit backend-deploymet \
  --build-strategy dockerfile \
  --build-dockerfile apps/web/Dockerfile \
  --build-git-repo-secret pitch-github-ssh-ym \
  --build-timeout 1200 \
  --build-size medium \
  --image ghcr.io/ymamoun/pitch-frontend:build3-test \
  --registry-secret github-pat-ym-2 \
  --scale-down-delay 900 

# Create backend deployment
ibmcloud ce application create \
  --name pitch-backend-ym-test-9 \
  --build-source git@github.com:MmagdyHafezZ/pitch.git \
  --build-commit backend-deploymet \
  --build-strategy dockerfile \
  --build-dockerfile apps/api/code_engine/Dockerfile \
  --build-git-repo-secret pitch-github-ssh-ym \
  --build-timeout 1200 \
  --build-size medium \
  --image ghcr.io/ymamoun/pitch-backend:build2-test \
  --registry-secret github-pat-ym-2 \
  --env-from-secret pitch-env-var \
  --scale-down-delay 900


# Create TLS secret
ibmcloud ce secret create --name pitchapp-tls --format tls \
  --private-key-file deployment/key.pem \
  --cert-chain-file deployment/cert.pem

# Create domain mapping for backend
ibmcloud ce domainmapping create \
  --domain-name api.pitchapp.ca \
  --target pitch-backend-ym-test-9 \
  --target-type application \
  --tls-secret pitchapp-tls


# Create domain mapping for frontend
ibmcloud ce domainmapping create \
  --domain-name pitchapp.ca \
  --target pitch-frontend-ym-test-10 \
  --target-type application \
  --tls-secret pitchapp-tls

ibmcloud ce domainmapping create \
  --domain-name www.pitchapp.ca \
  --target pitch-frontend-ym-test-9 \
  --target-type application \
  --tls-secret pitchapp-tls

