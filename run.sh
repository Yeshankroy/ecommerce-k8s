#!/bin/bash

# E-Commerce K8s Deployment Script
# This script automates the deployment of the 3-tier application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${DOCKER_REGISTRY:-docker.io/yourusername}"
NAMESPACE="ecommerce"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}E-Commerce K8s Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Function to print section headers
print_header() {
    echo -e "\n${YELLOW}>>> $1${NC}\n"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_header "Checking Prerequisites"

if ! command_exists kubectl; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}Error: docker is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ kubectl found${NC}"
echo -e "${GREEN}✓ docker found${NC}"

# Check kubectl connection
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected to Kubernetes cluster${NC}"

# Ask for Docker registry
echo -e "\n${YELLOW}Enter your Docker registry (e.g., docker.io/username, gcr.io/project):${NC}"
read -p "Registry [$REGISTRY]: " input_registry
REGISTRY="${input_registry:-$REGISTRY}"

echo -e "${GREEN}Using registry: $REGISTRY${NC}"

# Build Docker images
print_header "Step 1: Building Docker Images"

echo "Building products-service..."
cd products-service
docker build -t ${REGISTRY}/products-service:latest .
echo -e "${GREEN}✓ Products service built${NC}"

echo "Building orders-service..."
cd ../orders-service
docker build -t ${REGISTRY}/orders-service:latest .
echo -e "${GREEN}✓ Orders service built${NC}"

echo "Building frontend..."
cd ../frontend
docker build -t ${REGISTRY}/frontend:latest .
echo -e "${GREEN}✓ Frontend built${NC}"

cd ..

# Push images
print_header "Step 2: Pushing Images to Registry"

echo "Do you want to push images to registry? (y/n)"
read -p "Push? [y]: " push_images
push_images="${push_images:-y}"

if [[ "$push_images" == "y" ]]; then
    echo "Logging into Docker registry..."
    docker login
    
    echo "Pushing products-service..."
    docker push ${REGISTRY}/products-service:latest
    
    echo "Pushing orders-service..."
    docker push ${REGISTRY}/orders-service:latest
    
    echo "Pushing frontend..."
    docker push ${REGISTRY}/frontend:latest
    
    echo -e "${GREEN}✓ All images pushed${NC}"
else
    echo -e "${YELLOW}Skipping image push. Using local images.${NC}"
fi

# Update Kubernetes manifests
print_header "Step 3: Updating Kubernetes Manifests"

echo "Updating image references in deployment files..."

# Update products deployment
sed -i.bak "s|image: your-registry/products-service:latest|image: ${REGISTRY}/products-service:latest|g" kubernetes/products-deployment.yaml

# Update orders deployment
sed -i.bak "s|image: your-registry/orders-service:latest|image: ${REGISTRY}/orders-service:latest|g" kubernetes/orders-deployment.yaml

# Update frontend deployment
sed -i.bak "s|image: your-registry/frontend:latest|image: ${REGISTRY}/frontend:latest|g" kubernetes/frontend-deployment.yaml

echo -e "${GREEN}✓ Manifests updated${NC}"

# Deploy to Kubernetes
print_header "Step 4: Deploying to Kubernetes"

echo "Creating namespace..."
kubectl apply -f kubernetes/namespace.yaml

echo "Deploying database layer..."
kubectl apply -f kubernetes/postgres-configmap.yaml
kubectl apply -f kubernetes/postgres-secret.yaml
kubectl apply -f kubernetes/postgres-pvc.yaml
kubectl apply -f kubernetes/postgres-deployment.yaml
kubectl apply -f kubernetes/postgres-service.yaml

echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=180s
echo -e "${GREEN}✓ Database ready${NC}"

echo "Deploying Products service..."
kubectl apply -f kubernetes/products-deployment.yaml
kubectl apply -f kubernetes/products-service.yaml

echo "Deploying Orders service..."
kubectl apply -f kubernetes/orders-deployment.yaml
kubectl apply -f kubernetes/orders-service.yaml

echo "Waiting for backend services to be ready..."
kubectl wait --for=condition=ready pod -l app=products-service -n ${NAMESPACE} --timeout=180s
kubectl wait --for=condition=ready pod -l app=orders-service -n ${NAMESPACE} --timeout=180s
echo -e "${GREEN}✓ Backend services ready${NC}"

echo "Deploying API Gateway..."
kubectl apply -f kubernetes/api-gateway-configmap.yaml
kubectl apply -f kubernetes/api-gateway-deployment.yaml
kubectl apply -f kubernetes/api-gateway-service.yaml

echo "Deploying Frontend..."
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/frontend-service.yaml

echo "Waiting for frontend to be ready..."
kubectl wait --for=condition=ready pod -l app=frontend -n ${NAMESPACE} --timeout=180s
echo -e "${GREEN}✓ Frontend ready${NC}"

echo "Deploying auto-scalers..."
kubectl apply -f kubernetes/hpa-products.yaml
kubectl apply -f kubernetes/hpa-orders.yaml

# Verify deployment
print_header "Step 5: Verifying Deployment"

echo "Checking pod status..."
kubectl get pods -n ${NAMESPACE}

echo -e "\nChecking services..."
kubectl get svc -n ${NAMESPACE}

echo -e "\nChecking HPAs..."
kubectl get hpa -n ${NAMESPACE}

# Get access information
print_header "Step 6: Access Information"

echo "Waiting for LoadBalancer IP assignment..."
sleep 10

EXTERNAL_IP=$(kubectl get svc frontend-service -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

if [ -z "$EXTERNAL_IP" ]; then
    echo -e "${YELLOW}LoadBalancer IP not yet assigned. Checking for NodePort...${NC}"
    NODE_PORT=$(kubectl get svc frontend-service -n ${NAMESPACE} -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
    
    if [ -n "$NODE_PORT" ]; then
        NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || echo "localhost")
        echo -e "${GREEN}Application is accessible at: http://${NODE_IP}:${NODE_PORT}${NC}"
    else
        echo -e "${YELLOW}Setting up port-forward for local access...${NC}"
        echo "Run this command to access the application:"
        echo -e "${GREEN}kubectl port-forward -n ${NAMESPACE} svc/frontend-service 8080:80${NC}"
        echo "Then open: http://localhost:8080"
    fi
else
    echo -e "${GREEN}Application is accessible at: http://${EXTERNAL_IP}${NC}"
fi

# Summary
print_header "Deployment Complete!"

echo -e "${GREEN}✓ All services deployed successfully${NC}"
echo ""
echo "Useful commands:"
echo "  View all pods:     kubectl get pods -n ${NAMESPACE}"
echo "  View logs:         kubectl logs -f -l app=products-service -n ${NAMESPACE}"
echo "  Scale service:     kubectl scale deployment products-service --replicas=5 -n ${NAMESPACE}"
echo "  Delete all:        kubectl delete namespace ${NAMESPACE}"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
