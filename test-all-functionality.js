#!/usr/bin/env node

/**
 * Comprehensive Test Suite for AIVA Application
 * Tests all major functionalities
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  startTime: Date.now()
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'info': 'ℹ️',
    'pass': '✅',
    'fail': '❌',
    'warn': '⚠️'
  }[type] || 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function test(name, testFn) {
  try {
    log(`Testing: ${name}`, 'info');
    const result = testFn();
    if (result === true || (result && result.success)) {
      testResults.passed.push(name);
      log(`PASSED: ${name}`, 'pass');
      return true;
    } else {
      testResults.failed.push({ name, error: result?.error || 'Test failed' });
      log(`FAILED: ${name} - ${result?.error || 'Unknown error'}`, 'fail');
      return false;
    }
  } catch (error) {
    testResults.failed.push({ name, error: error.message });
    log(`FAILED: ${name} - ${error.message}`, 'fail');
    return false;
  }
}

// Test 1: Backend Build
function testBackendBuild() {
  try {
    const serverPath = path.join(__dirname, 'server');
    process.chdir(serverPath);
    execSync('npm run build', { stdio: 'pipe', timeout: 60000 });
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 2: Frontend Build
function testFrontendBuild() {
  try {
    process.chdir(__dirname);
    execSync('npm run build', { stdio: 'pipe', timeout: 120000 });
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 3: TypeScript Configuration
function testTypeScriptConfig() {
  try {
    const serverTsConfig = path.join(__dirname, 'server', 'tsconfig.json');
    const frontendTsConfig = path.join(__dirname, 'tsconfig.json');
    
    if (!fs.existsSync(serverTsConfig)) {
      return { success: false, error: 'Server tsconfig.json not found' };
    }
    if (!fs.existsSync(frontendTsConfig)) {
      return { success: false, error: 'Frontend tsconfig.json not found' };
    }
    
    const serverConfig = JSON.parse(fs.readFileSync(serverTsConfig, 'utf8'));
    const frontendConfig = JSON.parse(fs.readFileSync(frontendTsConfig, 'utf8'));
    
    if (!serverConfig.compilerOptions) {
      return { success: false, error: 'Server tsconfig missing compilerOptions' };
    }
    if (!frontendConfig.compilerOptions) {
      return { success: false, error: 'Frontend tsconfig missing compilerOptions' };
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 4: Package Dependencies
function testDependencies() {
  try {
    const serverPackage = path.join(__dirname, 'server', 'package.json');
    const frontendPackage = path.join(__dirname, 'package.json');
    
    if (!fs.existsSync(serverPackage) || !fs.existsSync(frontendPackage)) {
      return { success: false, error: 'Package.json files not found' };
    }
    
    const serverPkg = JSON.parse(fs.readFileSync(serverPackage, 'utf8'));
    const frontendPkg = JSON.parse(fs.readFileSync(frontendPackage, 'utf8'));
    
    const requiredServerDeps = ['express', 'mssql', 'dotenv', 'jsonwebtoken'];
    const requiredFrontendDeps = ['react', 'react-dom', 'react-router-dom'];
    
    const missingServer = requiredServerDeps.filter(dep => !serverPkg.dependencies?.[dep]);
    const missingFrontend = requiredFrontendDeps.filter(dep => !frontendPkg.dependencies?.[dep]);
    
    if (missingServer.length > 0) {
      return { success: false, error: `Missing server dependencies: ${missingServer.join(', ')}` };
    }
    if (missingFrontend.length > 0) {
      return { success: false, error: `Missing frontend dependencies: ${missingFrontend.join(', ')}` };
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 5: File Structure
function testFileStructure() {
  try {
    const requiredFiles = [
      'server/src/index.ts',
      'server/src/config/database.ts',
      'server/src/routes/auth.ts',
      'server/src/routes/userCardScan.ts',
      'server/src/services/cardDataService.ts',
      'src/App.tsx',
      'src/utils/api.ts',
      'vite.config.ts',
      'package.json',
      'server/package.json'
    ];
    
    const missing = requiredFiles.filter(file => {
      const filePath = path.join(__dirname, file);
      return !fs.existsSync(filePath);
    });
    
    if (missing.length > 0) {
      return { success: false, error: `Missing files: ${missing.join(', ')}` };
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 6: Environment Configuration
function testEnvironmentConfig() {
  try {
    const envExample = path.join(__dirname, '.env.example');
    const gitignore = path.join(__dirname, '.gitignore');
    
    if (!fs.existsSync(gitignore)) {
      testResults.warnings.push('No .gitignore file found');
    }
    
    // Check if .env is in .gitignore
    if (fs.existsSync(gitignore)) {
      const gitignoreContent = fs.readFileSync(gitignore, 'utf8');
      if (!gitignoreContent.includes('.env')) {
        testResults.warnings.push('.env file should be in .gitignore');
      }
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 7: Code Quality Checks
function testCodeQuality() {
  try {
    const serverSrc = path.join(__dirname, 'server', 'src');
    const frontendSrc = path.join(__dirname, 'src');
    
    // Check for console.log in production code (should use logger)
    const checkConsoleLogs = (dir, context) => {
      const files = getAllFiles(dir);
      const issues = [];
      
      files.forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const content = fs.readFileSync(file, 'utf8');
          // Allow console.log in index.ts for startup logging
          if (content.includes('console.log') && !file.includes('index.ts')) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
              if (line.includes('console.log') && !line.includes('// Using console.log')) {
                issues.push(`${file}:${index + 1}`);
              }
            });
          }
        }
      });
      
      return issues;
    };
    
    const serverIssues = checkConsoleLogs(serverSrc, 'server');
    const frontendIssues = checkConsoleLogs(frontendSrc, 'frontend');
    
    if (serverIssues.length > 0) {
      testResults.warnings.push(`Console.log found in server code: ${serverIssues.slice(0, 3).join(', ')}`);
    }
    
    // Frontend console.log is acceptable for debugging
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('dist')) {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Test 8: Database Schema
function testDatabaseSchema() {
  try {
    const dbFile = path.join(__dirname, 'server', 'src', 'config', 'database.ts');
    if (!fs.existsSync(dbFile)) {
      return { success: false, error: 'database.ts not found' };
    }
    
    const content = fs.readFileSync(dbFile, 'utf8');
    
    // Check for CardScans table creation
    if (!content.includes('CREATE TABLE CardScans')) {
      return { success: false, error: 'CardScans table not found in schema' };
    }
    
    // Check for indexes
    const requiredIndexes = [
      'IX_CardScans_UserId',
      'IX_CardScans_MobileNumber',
      'IX_CardScans_CivilIdNo'
    ];
    
    const missingIndexes = requiredIndexes.filter(idx => !content.includes(idx));
    if (missingIndexes.length > 0) {
      testResults.warnings.push(`Missing database indexes: ${missingIndexes.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 9: Security Checks
function testSecurity() {
  try {
    const userCardScan = path.join(__dirname, 'server', 'src', 'routes', 'userCardScan.ts');
    if (fs.existsSync(userCardScan)) {
      const content = fs.readFileSync(userCardScan, 'utf8');
      
      // Check for encryption secret validation
      if (!content.includes('CARD_ENCRYPTION_SECRET') || 
          (content.includes('default-secret-key-for-development') && !content.includes('NODE_ENV === \'production\''))) {
        testResults.warnings.push('Encryption secret validation may need improvement');
      }
      
      // Check for authentication middleware
      if (!content.includes('authenticateToken')) {
        return { success: false, error: 'userCardScan routes missing authentication' };
      }
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 10: API Routes Structure
function testAPIRoutes() {
  try {
    const routesDir = path.join(__dirname, 'server', 'src', 'routes');
    const requiredRoutes = [
      'auth.ts',
      'chat.ts',
      'userCardScan.ts',
      'cardScan.ts',
      'files.ts',
      'workspace.ts'
    ];
    
    const missing = requiredRoutes.filter(route => {
      return !fs.existsSync(path.join(routesDir, route));
    });
    
    if (missing.length > 0) {
      return { success: false, error: `Missing route files: ${missing.join(', ')}` };
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 11: Frontend Components
function testFrontendComponents() {
  try {
    const componentsDir = path.join(__dirname, 'src', 'components');
    const requiredComponents = [
      'CardScanning.tsx',
      'MobileCardScanning.tsx',
      'Dashboard.tsx',
      'LoginPage.tsx'
    ];
    
    const missing = requiredComponents.filter(comp => {
      return !fs.existsSync(path.join(componentsDir, comp));
    });
    
    if (missing.length > 0) {
      return { success: false, error: `Missing components: ${missing.join(', ')}` };
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 12: Build Configuration
function testBuildConfig() {
  try {
    const viteConfig = path.join(__dirname, 'vite.config.ts');
    if (!fs.existsSync(viteConfig)) {
      return { success: false, error: 'vite.config.ts not found' };
    }
    
    const content = fs.readFileSync(viteConfig, 'utf8');
    
    // Check for production optimizations
    if (!content.includes('build:')) {
      testResults.warnings.push('Vite build configuration may need optimization');
    }
    
    return true;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Run all tests
console.log('\n🧪 Starting Comprehensive Functionality Tests...\n');
console.log('='.repeat(60));

test('Backend TypeScript Build', testBackendBuild);
test('Frontend TypeScript Build', testFrontendBuild);
test('TypeScript Configuration', testTypeScriptConfig);
test('Package Dependencies', testDependencies);
test('File Structure', testFileStructure);
test('Environment Configuration', testEnvironmentConfig);
test('Code Quality', testCodeQuality);
test('Database Schema', testDatabaseSchema);
test('Security Checks', testSecurity);
test('API Routes Structure', testAPIRoutes);
test('Frontend Components', testFrontendComponents);
test('Build Configuration', testBuildConfig);

// Generate Report
const endTime = Date.now();
const duration = ((endTime - testResults.startTime) / 1000).toFixed(2);

console.log('\n' + '='.repeat(60));
console.log('\n📊 TEST SUMMARY\n');
console.log(`✅ Passed: ${testResults.passed.length}`);
console.log(`❌ Failed: ${testResults.failed.length}`);
console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
console.log(`⏱️  Duration: ${duration}s\n`);

if (testResults.failed.length > 0) {
  console.log('❌ FAILED TESTS:');
  testResults.failed.forEach(({ name, error }) => {
    console.log(`   - ${name}: ${error}`);
  });
  console.log('');
}

if (testResults.warnings.length > 0) {
  console.log('⚠️  WARNINGS:');
  testResults.warnings.forEach(warning => {
    console.log(`   - ${warning}`);
  });
  console.log('');
}

if (testResults.passed.length > 0) {
  console.log('✅ PASSED TESTS:');
  testResults.passed.forEach(name => {
    console.log(`   - ${name}`);
  });
  console.log('');
}

const exitCode = testResults.failed.length > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? '✅ All critical tests passed!' : '❌ Some tests failed!'}\n`);

process.exit(exitCode);

