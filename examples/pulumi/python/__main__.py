"""Pulumi Python example for Infrastructure Drift Detector"""
import pulumi
import pulumi_aws as aws

# Load configuration
config = pulumi.Config()
environment = config.get("environment") or "dev"
instance_type = config.get("instanceType") or "t3.micro"

# Create VPC
vpc = aws.ec2.Vpc("app-vpc",
    cidr_block="10.0.0.0/16",
    enable_dns_hostnames=True,
    enable_dns_support=True,
    tags={
        "Name": f"{environment}-vpc",
        "Environment": environment,
    })

# Create subnet
subnet = aws.ec2.Subnet("app-subnet",
    vpc_id=vpc.id,
    cidr_block="10.0.1.0/24",
    availability_zone="us-east-1a",
    tags={
        "Name": f"{environment}-subnet",
        "Environment": environment,
    })

# Create security group
security_group = aws.ec2.SecurityGroup("app-sg",
    vpc_id=vpc.id,
    description="Allow HTTP and SSH traffic",
    ingress=[
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp",
            from_port=80,
            to_port=80,
            cidr_blocks=["0.0.0.0/0"],
            description="Allow HTTP",
        ),
        aws.ec2.SecurityGroupIngressArgs(
            protocol="tcp",
            from_port=22,
            to_port=22,
            cidr_blocks=["0.0.0.0/0"],
            description="Allow SSH",
        ),
    ],
    egress=[
        aws.ec2.SecurityGroupEgressArgs(
            protocol="-1",
            from_port=0,
            to_port=0,
            cidr_blocks=["0.0.0.0/0"],
            description="Allow all outbound",
        ),
    ],
    tags={
        "Name": f"{environment}-sg",
        "Environment": environment,
    })

# Create S3 bucket
bucket = aws.s3.Bucket("app-bucket",
    acl="private",
    versioning=aws.s3.BucketVersioningArgs(
        enabled=True,
    ),
    server_side_encryption_configuration=aws.s3.BucketServerSideEncryptionConfigurationArgs(
        rule=aws.s3.BucketServerSideEncryptionConfigurationRuleArgs(
            apply_server_side_encryption_by_default=aws.s3.BucketServerSideEncryptionConfigurationRuleApplyServerSideEncryptionByDefaultArgs(
                sse_algorithm="AES256",
            ),
        ),
    ),
    tags={
        "Name": f"{environment}-bucket",
        "Environment": environment,
    })

# Create EC2 instance
instance = aws.ec2.Instance("web-server",
    ami="ami-0c55b159cbfafe1f0",  # Amazon Linux 2
    instance_type=instance_type,
    subnet_id=subnet.id,
    vpc_security_group_ids=[security_group.id],
    tags={
        "Name": f"{environment}-web-server",
        "Environment": environment,
        "Role": "web",
    },
    opts=pulumi.ResourceOptions(
        depends_on=[subnet, security_group],
    ))

# Export outputs
pulumi.export("vpcId", vpc.id)
pulumi.export("subnetId", subnet.id)
pulumi.export("securityGroupId", security_group.id)
pulumi.export("bucketName", bucket.id)
pulumi.export("instanceId", instance.id)
pulumi.export("instancePublicIp", instance.public_ip)
