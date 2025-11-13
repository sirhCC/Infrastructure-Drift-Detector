import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Load configuration
const config = new pulumi.Config();
const environment = config.get("environment") || "dev";
const instanceType = config.get("instanceType") || "t3.micro";

// Create a VPC
const vpc = new aws.ec2.Vpc("app-vpc", {
    cidrBlock: "10.0.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: `${environment}-vpc`,
        Environment: environment,
    },
});

// Create a subnet
const subnet = new aws.ec2.Subnet("app-subnet", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "us-east-1a",
    tags: {
        Name: `${environment}-subnet`,
        Environment: environment,
    },
});

// Create a security group
const securityGroup = new aws.ec2.SecurityGroup("app-sg", {
    vpcId: vpc.id,
    description: "Allow HTTP and SSH traffic",
    ingress: [
        {
            protocol: "tcp",
            fromPort: 80,
            toPort: 80,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow HTTP",
        },
        {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow SSH",
        },
    ],
    egress: [
        {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow all outbound",
        },
    ],
    tags: {
        Name: `${environment}-sg`,
        Environment: environment,
    },
});

// Create an S3 bucket
const bucket = new aws.s3.Bucket("app-bucket", {
    acl: "private",
    versioning: {
        enabled: true,
    },
    serverSideEncryptionConfiguration: {
        rule: {
            applyServerSideEncryptionByDefault: {
                sseAlgorithm: "AES256",
            },
        },
    },
    tags: {
        Name: `${environment}-bucket`,
        Environment: environment,
    },
});

// Create an EC2 instance
const instance = new aws.ec2.Instance("web-server", {
    ami: "ami-0c55b159cbfafe1f0", // Amazon Linux 2
    instanceType: instanceType,
    subnetId: subnet.id,
    vpcSecurityGroupIds: [securityGroup.id],
    tags: {
        Name: `${environment}-web-server`,
        Environment: environment,
        Role: "web",
    },
}, {
    protect: false,
    dependsOn: [subnet, securityGroup],
});

// Export resource information
export const vpcId = vpc.id;
export const subnetId = subnet.id;
export const securityGroupId = securityGroup.id;
export const bucketName = bucket.id;
export const instanceId = instance.id;
export const instancePublicIp = instance.publicIp;
