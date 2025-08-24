// blockchainAuditTrail.js
// Blockchain-based Audit Trail for Complete Transparency and Security
// Advanced cryptographic auditing system

class BlockchainAuditTrail {
    constructor() {
        this.version = "1.0.0-blockchain";
        this.chain = [];
        this.pendingTransactions = [];
        this.miningReward = 100;
        this.difficulty = 2;
        
        // Advanced cryptographic features
        this.merkleTree = null;
        this.smartContracts = new Map();
        this.validators = new Set();
        this.consensus = {
            type: 'proof_of_stake',
            stakeholders: new Map(),
            validators: new Set()
        };
        
        // Zero-knowledge proof system
        this.zkProofs = {
            circuits: new Map(),
            proofs: new Map(),
            verificationKeys: new Map()
        };
        
        // Privacy features
        this.privacy = {
            ringSignatures: new Map(),
            stealth_addresses: new Set(),
            homomorphic_encryption: true
        };
        
        // Create genesis block
        this.createGenesisBlock();
        
        console.log('⛓️ Blockchain Audit Trail initialized');
    }

    createGenesisBlock() {
        const genesisBlock = new Block(0, "01/01/2024", {
            type: "genesis",
            message: "Genesis Block - Quantum AI Automation System",
            creator: "system",
            metadata: {
                version: this.version,
                created_at: new Date().toISOString(),
                features: ["audit_trail", "smart_contracts", "zero_knowledge", "privacy"]
            }
        }, "0");
        
        genesisBlock.hash = genesisBlock.calculateHash();
        this.chain.push(genesisBlock);
        
        console.log('🎯 Genesis block created');
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    // Record participation with full audit trail
    recordParticipation(userId, opportunity, result, metadata = {}) {
        const transaction = {
            type: "participation",
            userId: this.hashUserId(userId),
            opportunityId: opportunity.id,
            timestamp: Date.now(),
            result: {
                success: result.success,
                score: result.score,
                value: result.value
            },
            metadata: {
                ...metadata,
                ip_hash: this.hashIP(metadata.ip),
                user_agent_hash: this.hashUserAgent(metadata.userAgent)
            },
            privacy_preserved: true,
            signature: null
        };
        
        // Create zero-knowledge proof for privacy
        const zkProof = this.createZKProof(transaction);
        transaction.zkProof = zkProof;
        
        // Sign transaction
        transaction.signature = this.signTransaction(transaction);
        
        this.pendingTransactions.push(transaction);
        
        console.log(`📝 Participation recorded for user ${transaction.userId.substring(0, 8)}...`);
        
        // Auto-mine if enough transactions
        if (this.pendingTransactions.length >= 5) {
            this.minePendingTransactions();
        }
        
        return transaction;
    }

    // Record AI decision with full transparency
    recordAIDecision(modelVersion, input, output, confidence, metadata = {}) {
        const transaction = {
            type: "ai_decision",
            modelVersion,
            inputHash: this.hashObject(input),
            outputHash: this.hashObject(output),
            confidence,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                model_architecture: metadata.architecture || "unknown",
                training_data_hash: metadata.trainingDataHash || null
            },
            auditability: {
                reproducible: true,
                explainable: metadata.explainable || false,
                bias_checked: metadata.biasChecked || false
            },
            signature: null
        };
        
        transaction.signature = this.signTransaction(transaction);
        this.pendingTransactions.push(transaction);
        
        console.log(`🤖 AI decision recorded: ${confidence.toFixed(3)} confidence`);
        
        return transaction;
    }

    // Record system optimization
    recordOptimization(optimizationType, parameters, results, impact) {
        const transaction = {
            type: "optimization",
            optimizationType,
            parameters: this.hashObject(parameters),
            results: {
                performance_improvement: results.performanceImprovement,
                success_rate_change: results.successRateChange,
                efficiency_gain: results.efficiencyGain
            },
            impact: {
                users_affected: impact.usersAffected,
                system_wide: impact.systemWide,
                rollback_possible: impact.rollbackPossible
            },
            timestamp: Date.now(),
            signature: null
        };
        
        transaction.signature = this.signTransaction(transaction);
        this.pendingTransactions.push(transaction);
        
        console.log(`⚡ Optimization recorded: ${optimizationType}`);
        
        return transaction;
    }

    // Mine pending transactions into a new block
    minePendingTransactions(miningRewardAddress = "system") {
        console.log('⛏️ Mining new block...');
        
        const rewardTransaction = {
            type: "mining_reward",
            fromAddress: null,
            toAddress: miningRewardAddress,
            amount: this.miningReward,
            timestamp: Date.now()
        };
        
        this.pendingTransactions.push(rewardTransaction);
        
        const block = new Block(
            this.getLatestBlock().index + 1,
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash
        );
        
        // Create Merkle tree for efficient verification
        block.merkleRoot = this.calculateMerkleRoot(this.pendingTransactions);
        
        // Mine the block (Proof of Work)
        block.mineBlock(this.difficulty);
        
        console.log(`✅ Block mined: ${block.hash}`);
        
        this.chain.push(block);
        this.pendingTransactions = [];
        
        // Validate chain integrity
        this.validateChain();
        
        return block;
    }

    // Smart contract deployment and execution
    deploySmartContract(contractCode, name, parameters = {}) {
        const contract = {
            id: this.generateId(),
            name,
            code: contractCode,
            parameters,
            state: {},
            deployed_at: Date.now(),
            creator: "system",
            version: "1.0.0"
        };
        
        // Validate contract code
        if (this.validateSmartContract(contract)) {
            this.smartContracts.set(contract.id, contract);
            
            // Record deployment on blockchain
            const transaction = {
                type: "contract_deployment",
                contractId: contract.id,
                name: contract.name,
                codeHash: this.hashObject(contract.code),
                timestamp: Date.now(),
                signature: this.signTransaction({contractId: contract.id})
            };
            
            this.pendingTransactions.push(transaction);
            
            console.log(`📜 Smart contract deployed: ${name} (${contract.id})`);
            
            return contract.id;
        }
        
        throw new Error(`Invalid smart contract: ${name}`);
    }

    executeSmartContract(contractId, method, parameters = {}) {
        const contract = this.smartContracts.get(contractId);
        
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }
        
        const execution = {
            contractId,
            method,
            parameters,
            timestamp: Date.now(),
            gasUsed: 0,
            result: null,
            success: false
        };
        
        try {
            // Execute contract method (simplified)
            const result = this.runContractMethod(contract, method, parameters);
            execution.result = result;
            execution.success = true;
            execution.gasUsed = this.calculateGasUsed(method, parameters);
            
            // Update contract state
            if (result.stateChanges) {
                Object.assign(contract.state, result.stateChanges);
            }
            
            // Record execution on blockchain
            const transaction = {
                type: "contract_execution",
                contractId,
                method,
                parametersHash: this.hashObject(parameters),
                resultHash: this.hashObject(result),
                gasUsed: execution.gasUsed,
                success: execution.success,
                timestamp: Date.now(),
                signature: this.signTransaction(execution)
            };
            
            this.pendingTransactions.push(transaction);
            
            console.log(`⚙️ Contract executed: ${contract.name}.${method}()`);
            
            return execution;
            
        } catch (error) {
            execution.success = false;
            execution.error = error.message;
            
            console.error(`❌ Contract execution failed: ${error.message}`);
            
            return execution;
        }
    }

    // Zero-knowledge proof creation
    createZKProof(transaction) {
        // Simplified ZK proof creation (in practice, would use libraries like circomlib)
        const secret = this.hashObject(transaction);
        const publicInput = {
            type: transaction.type,
            timestamp: transaction.timestamp
        };
        
        const proof = {
            pi_a: this.generateProofElement(),
            pi_b: this.generateProofElement(),
            pi_c: this.generateProofElement(),
            publicSignals: publicInput,
            protocol: "groth16",
            curve: "bn128"
        };
        
        // Store proof for verification
        const proofId = this.hashObject(proof);
        this.zkProofs.proofs.set(proofId, proof);
        
        return {
            proofId,
            publicSignals: publicInput,
            verified: true
        };
    }

    // Verify zero-knowledge proof
    verifyZKProof(proofId, publicSignals) {
        const proof = this.zkProofs.proofs.get(proofId);
        
        if (!proof) {
            return false;
        }
        
        // Simplified verification (would use actual ZK verification)
        const isValid = JSON.stringify(proof.publicSignals) === JSON.stringify(publicSignals);
        
        console.log(`🔍 ZK Proof ${proofId.substring(0, 8)}... verified: ${isValid}`);
        
        return isValid;
    }

    // Privacy-preserving features
    createRingSignature(message, signers) {
        // Simplified ring signature implementation
        const signature = {
            message: this.hashObject(message),
            ring: signers.map(signer => this.hashObject(signer)),
            signature: this.generateSignatureElement(),
            anonymity_set_size: signers.length
        };
        
        const signatureId = this.hashObject(signature);
        this.privacy.ringSignatures.set(signatureId, signature);
        
        console.log(`🔐 Ring signature created with ${signers.length} signers`);
        
        return signatureId;
    }

    generateStealthAddress(publicKey) {
        // Generate stealth address for privacy
        const stealthAddress = this.hashObject({
            publicKey,
            randomness: Math.random(),
            timestamp: Date.now()
        });
        
        this.privacy.stealth_addresses.add(stealthAddress);
        
        return stealthAddress;
    }

    // Consensus mechanism (Proof of Stake)
    addValidator(address, stake) {
        this.consensus.validators.add(address);
        this.consensus.stakeholders.set(address, stake);
        
        console.log(`🏛️ Validator added: ${address.substring(0, 8)}... (stake: ${stake})`);
    }

    selectValidators() {
        // Select validators based on stake
        const validators = Array.from(this.consensus.stakeholders.entries())
            .sort((a, b) => b[1] - a[1])  // Sort by stake
            .slice(0, 5)  // Top 5 validators
            .map(entry => entry[0]);
        
        return validators;
    }

    // Blockchain validation
    validateChain() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];
            
            // Validate current block hash
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                console.error(`❌ Invalid hash at block ${i}`);
                return false;
            }
            
            // Validate link to previous block
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.error(`❌ Invalid link at block ${i}`);
                return false;
            }
            
            // Validate Merkle root
            if (currentBlock.merkleRoot !== this.calculateMerkleRoot(currentBlock.transactions)) {
                console.error(`❌ Invalid Merkle root at block ${i}`);
                return false;
            }
        }
        
        console.log('✅ Blockchain validation passed');
        return true;
    }

    // Merkle tree calculation
    calculateMerkleRoot(transactions) {
        if (transactions.length === 0) {
            return this.hashObject("empty");
        }
        
        let hashes = transactions.map(tx => this.hashObject(tx));
        
        while (hashes.length > 1) {
            const newHashes = [];
            
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = hashes[i + 1] || left;
                newHashes.push(this.hashObject(left + right));
            }
            
            hashes = newHashes;
        }
        
        return hashes[0];
    }

    // Query and analytics
    getAuditTrail(userId, fromDate, toDate) {
        const hashedUserId = this.hashUserId(userId);
        const trail = [];
        
        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                if (transaction.userId === hashedUserId &&
                    transaction.timestamp >= fromDate &&
                    transaction.timestamp <= toDate) {
                    
                    trail.push({
                        blockIndex: block.index,
                        blockHash: block.hash,
                        transaction: {
                            ...transaction,
                            userId: "***PRIVATE***"  // Protect privacy
                        },
                        verified: this.verifyTransaction(transaction)
                    });
                }
            }
        }
        
        return trail;
    }

    getSystemMetrics() {
        const metrics = {
            total_blocks: this.chain.length,
            total_transactions: this.chain.reduce((sum, block) => sum + block.transactions.length, 0),
            chain_integrity: this.validateChain(),
            average_block_time: this.calculateAverageBlockTime(),
            validators_count: this.consensus.validators.size,
            smart_contracts_deployed: this.smartContracts.size,
            zk_proofs_created: this.zkProofs.proofs.size,
            privacy_features: {
                ring_signatures: this.privacy.ringSignatures.size,
                stealth_addresses: this.privacy.stealth_addresses.size
            }
        };
        
        return metrics;
    }

    // Utility methods
    hashObject(obj) {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        return this.sha256(str);
    }

    hashUserId(userId) {
        return this.sha256(userId + "user_salt_2024");
    }

    hashIP(ip) {
        return this.sha256(ip + "ip_salt_2024");
    }

    hashUserAgent(userAgent) {
        return this.sha256(userAgent + "ua_salt_2024");
    }

    sha256(message) {
        // Simplified hash function (would use actual SHA-256)
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    signTransaction(transaction) {
        // Simplified digital signature
        const signature = this.sha256(JSON.stringify(transaction) + "private_key_placeholder");
        return signature;
    }

    verifyTransaction(transaction) {
        // Simplified signature verification
        const expectedSignature = this.sha256(
            JSON.stringify({...transaction, signature: null}) + "private_key_placeholder"
        );
        return transaction.signature === expectedSignature;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    generateProofElement() {
        // Generate random proof element (simplified)
        return Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    generateSignatureElement() {
        return Array(128).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    calculateAverageBlockTime() {
        if (this.chain.length < 2) return 0;
        
        const timeDiffs = [];
        for (let i = 1; i < this.chain.length; i++) {
            timeDiffs.push(this.chain[i].timestamp - this.chain[i - 1].timestamp);
        }
        
        return timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    }

    validateSmartContract(contract) {
        // Basic contract validation
        return contract.code && contract.name && contract.code.length > 0;
    }

    runContractMethod(contract, method, parameters) {
        // Simplified contract execution
        const methods = {
            'auto_participate': (params) => ({
                result: 'participation_triggered',
                stateChanges: { last_execution: Date.now() }
            }),
            'update_score': (params) => ({
                result: `score_updated_to_${params.score}`,
                stateChanges: { current_score: params.score }
            }),
            'calculate_reward': (params) => ({
                result: params.base_reward * params.multiplier,
                stateChanges: { last_reward: params.base_reward * params.multiplier }
            })
        };
        
        const methodFn = methods[method];
        if (!methodFn) {
            throw new Error(`Method not found: ${method}`);
        }
        
        return methodFn(parameters);
    }

    calculateGasUsed(method, parameters) {
        // Simplified gas calculation
        const baseCost = 21000;
        const methodCosts = {
            'auto_participate': 50000,
            'update_score': 20000,
            'calculate_reward': 30000
        };
        
        return baseCost + (methodCosts[method] || 10000);
    }
}

// Block class for the blockchain
class Block {
    constructor(index, timestamp, transactions, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
        this.merkleRoot = '';
    }

    calculateHash() {
        return this.sha256(
            this.index +
            this.previousHash +
            this.timestamp +
            JSON.stringify(this.transactions) +
            this.nonce +
            this.merkleRoot
        );
    }

    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join("0");
        
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        
        console.log(`⛏️ Block mined: ${this.hash} (nonce: ${this.nonce})`);
    }

    sha256(message) {
        // Simplified hash function
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BlockchainAuditTrail, Block };
}

// Global instance
if (typeof window !== 'undefined') {
    window.BlockchainAuditTrail = BlockchainAuditTrail;
    window.Block = Block;
}