pipeline {
    agent any
    
    parameters {
        string(name: 'PROJECT_NAME', defaultValue: 'default', description: 'Project name')
        choice(name: 'COMPLIANCE_FRAMEWORK', choices: ['', 'CIS', 'PCI-DSS', 'HIPAA', 'SOC2'], description: 'Compliance framework to check')
        booleanParam(name: 'RUN_REMEDIATION', defaultValue: false, description: 'Run auto-remediation')
        booleanParam(name: 'DRY_RUN', defaultValue: true, description: 'Dry run mode for remediation')
    }
    
    environment {
        NODE_VERSION = '20'
        TERRAFORM_PATH = './infrastructure'
        DRIFT_THRESHOLD_CRITICAL = '0'
        DRIFT_THRESHOLD_HIGH = '5'
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    echo "Setting up Infrastructure Drift Detector"
                    sh 'node --version'
                    sh 'npm --version'
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }
        
        stage('Configure Credentials') {
            parallel {
                stage('AWS') {
                    when {
                        expression { env.AWS_ACCESS_KEY_ID }
                    }
                    steps {
                        withCredentials([
                            string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'),
                            string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY'),
                            string(credentialsId: 'aws-region', variable: 'AWS_REGION')
                        ]) {
                            sh '''
                                export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
                                export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
                                export AWS_REGION=$AWS_REGION
                            '''
                        }
                    }
                }
                
                stage('Azure') {
                    when {
                        expression { env.AZURE_CLIENT_ID }
                    }
                    steps {
                        withCredentials([
                            string(credentialsId: 'azure-client-id', variable: 'AZURE_CLIENT_ID'),
                            string(credentialsId: 'azure-client-secret', variable: 'AZURE_CLIENT_SECRET'),
                            string(credentialsId: 'azure-tenant-id', variable: 'AZURE_TENANT_ID')
                        ]) {
                            sh '''
                                export AZURE_CLIENT_ID=$AZURE_CLIENT_ID
                                export AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET
                                export AZURE_TENANT_ID=$AZURE_TENANT_ID
                            '''
                        }
                    }
                }
                
                stage('GCP') {
                    when {
                        expression { env.GCP_SERVICE_ACCOUNT }
                    }
                    steps {
                        withCredentials([
                            file(credentialsId: 'gcp-service-account-key', variable: 'GOOGLE_APPLICATION_CREDENTIALS')
                        ]) {
                            sh 'export GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS'
                        }
                    }
                }
            }
        }
        
        stage('Drift Detection Scan') {
            steps {
                script {
                    echo "Running drift detection scan for project: ${params.PROJECT_NAME}"
                    
                    sh """
                        npx ts-node src/cli/index.ts scan \
                            --project "${params.PROJECT_NAME}" \
                            --terraform "${env.TERRAFORM_PATH}" \
                            --output drift-report.json \
                            --format json
                    """
                    
                    def report = readJSON file: 'drift-report.json'
                    env.DRIFT_COUNT = report.summary.drifted
                    env.CRITICAL_COUNT = report.summary.critical
                    env.HIGH_COUNT = report.summary.high
                    
                    echo "Drift detected: ${env.DRIFT_COUNT} resources"
                    echo "Critical: ${env.CRITICAL_COUNT}, High: ${env.HIGH_COUNT}"
                }
            }
        }
        
        stage('Advanced Analysis') {
            when {
                expression { env.DRIFT_COUNT.toInteger() > 0 }
            }
            parallel {
                stage('Security Analysis') {
                    steps {
                        sh """
                            npx ts-node src/cli/index.ts analyze \
                                --project "${params.PROJECT_NAME}" \
                                --security \
                                --output security-report.json
                        """
                    }
                }
                
                stage('Cost Analysis') {
                    steps {
                        sh """
                            npx ts-node src/cli/index.ts analyze \
                                --project "${params.PROJECT_NAME}" \
                                --cost \
                                --output cost-report.json
                        """
                    }
                }
                
                stage('Anomaly Detection') {
                    steps {
                        sh """
                            npx ts-node src/cli/index.ts analyze \
                                --project "${params.PROJECT_NAME}" \
                                --anomalies \
                                --threshold 0.7 \
                                --output anomaly-report.json
                        """
                    }
                }
                
                stage('Compliance Check') {
                    when {
                        expression { params.COMPLIANCE_FRAMEWORK != '' }
                    }
                    steps {
                        sh """
                            npx ts-node src/cli/index.ts analyze \
                                --project "${params.PROJECT_NAME}" \
                                --compliance "${params.COMPLIANCE_FRAMEWORK}" \
                                --output compliance-report.json
                        """
                    }
                }
            }
        }
        
        stage('Generate Reports') {
            when {
                expression { env.DRIFT_COUNT.toInteger() > 0 }
            }
            steps {
                sh """
                    npx ts-node src/cli/index.ts report \
                        --project "${params.PROJECT_NAME}" \
                        --format html \
                        --output drift-report.html
                """
                
                sh """
                    npx ts-node src/cli/index.ts report \
                        --project "${params.PROJECT_NAME}" \
                        --format csv \
                        --output drift-report.csv
                """
                
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'drift-report.html',
                    reportName: 'Drift Detection Report',
                    reportTitles: 'Infrastructure Drift'
                ])
            }
        }
        
        stage('Auto-Remediation') {
            when {
                allOf {
                    expression { params.RUN_REMEDIATION }
                    expression { env.DRIFT_COUNT.toInteger() > 0 }
                }
            }
            steps {
                script {
                    def remediationMode = params.DRY_RUN ? '--dry-run' : '--auto-approve'
                    
                    if (!params.DRY_RUN) {
                        input message: 'Approve remediation?', ok: 'Proceed'
                    }
                    
                    sh """
                        npx ts-node src/cli/index.ts remediate \
                            --project "${params.PROJECT_NAME}" \
                            --terraform "${env.TERRAFORM_PATH}" \
                            ${remediationMode} \
                            --output remediation-result.json
                    """
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: '*-report.json,*-report.html,*-report.csv,remediation-result.json', allowEmptyArchive: true
            
            script {
                if (fileExists('drift-report.json')) {
                    def report = readJSON file: 'drift-report.json'
                    def driftCount = report.summary.drifted
                    def criticalCount = report.summary.critical
                    
                    def status = driftCount > 0 ? 'DRIFT DETECTED' : 'NO DRIFT'
                    def color = criticalCount > 0 ? 'danger' : driftCount > 0 ? 'warning' : 'good'
                    
                    if (env.SLACK_WEBHOOK) {
                        slackSend(
                            channel: '#infrastructure',
                            color: color,
                            message: """
                                *Infrastructure Drift Detection - ${status}*
                                Project: ${params.PROJECT_NAME}
                                Drifted Resources: ${driftCount}
                                Critical: ${criticalCount}
                                High: ${report.summary.high}
                                <${env.BUILD_URL}|View Report>
                            """
                        )
                    }
                }
            }
        }
        
        success {
            echo 'Drift detection completed successfully'
        }
        
        failure {
            echo 'Drift detection failed'
            
            script {
                if (env.CRITICAL_COUNT && env.CRITICAL_COUNT.toInteger() > env.DRIFT_THRESHOLD_CRITICAL.toInteger()) {
                    error("Critical drift threshold exceeded: ${env.CRITICAL_COUNT} critical issues found")
                }
            }
        }
    }
}
