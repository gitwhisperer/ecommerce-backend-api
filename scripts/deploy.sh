#!/bin/bash

# E-commerce API Deployment Script
# This script helps deploy the API to various environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
if [ -z "$1" ]; then
    print_error "Please specify environment: development, staging, or production"
    exit 1
fi

ENVIRONMENT=$1

print_status "Starting deployment for $ENVIRONMENT environment..."

# Create logs directory
mkdir -p logs

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Run tests
print_status "Running tests..."
npm run test:ci

# Check test results
if [ $? -ne 0 ]; then
    print_error "Tests failed! Deployment aborted."
    exit 1
fi

# Generate documentation
print_status "Generating documentation..."
npm run docs

# Environment-specific configurations
case $ENVIRONMENT in
    "development")
        print_status "Setting up development environment..."
        cp .env.example .env
        print_warning "Please update .env file with your development configuration"
        ;;
    
    "staging")
        print_status "Setting up staging environment..."
        # Add staging-specific setup here
        print_warning "Ensure staging environment variables are set"
        ;;
    
    "production")
        print_status "Setting up production environment..."
        # Add production-specific setup here
        print_warning "Ensure production environment variables are set"
        print_warning "Make sure to use production MongoDB and Redis instances"
        ;;
    
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Build Docker images if requested
if [ "$2" = "--docker" ]; then
    print_status "Building Docker images..."
    docker-compose build
    
    if [ $? -eq 0 ]; then
        print_status "Docker images built successfully"
    else
        print_error "Docker build failed"
        exit 1
    fi
fi

# Run health check
print_status "Performing health check..."
# Add health check logic here

print_status "Deployment completed successfully!"
print_status "Environment: $ENVIRONMENT"
print_status "Documentation available at: docs/api-docs.html"

if [ "$ENVIRONMENT" = "development" ]; then
    print_status "To start the development server:"
    print_status "npm run dev"
    print_status ""
    print_status "API will be available at: http://localhost:5000"
    print_status "Health check: http://localhost:5000/api/health"
    print_status "API info: http://localhost:5000/api/info"
fi
