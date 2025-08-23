import Foundation
import os.log

@main
struct PerformanceTest {
    // Logger pour le suivi des performances
    private static let logger = Logger(subsystem: "com.surveillance.gratuite", category: "Performance")
    
    // File d'attente pour les opérations concurrentes
    private static let queue = DispatchQueue(
        label: "com.surveillance.gratuite.concurrent",
        attributes: [.concurrent],
        target: .global(qos: .userInitiated)
    )
    
    static func main() {
        logger.info("🚀 Démarrage des tests de performance...")
        
        // Test d'allocation mémoire
        let (memoryTime, memoryUsage) = measureMemoryPerformance()
        
        // Test des opérations sur les chaînes
        let stringResults = measureStringPerformance()
        
        // Test des opérations concurrentes
        let concurrentTime = measureConcurrentPerformance()
        
        // Test des opérations fichier
        let fileResults = measureFileOperations()
        
        // Affichage du résumé
        printSummary(
            memoryTime: memoryTime,
            memoryUsage: memoryUsage,
            stringResults: stringResults,
            concurrentTime: concurrentTime,
            fileResults: fileResults
        )
    }
    
    private static func measureMemoryPerformance() -> (TimeInterval, Int64) {
        logger.info("\n1. Test d'Allocation Mémoire")
        let capacity = 100_000
        var array = ContiguousArray<Int>()
        array.reserveCapacity(capacity)
        
        let start = DispatchTime.now()
        stride(from: 0, through: capacity, by: 1).forEach { array.append($0) }
        let end = DispatchTime.now()
        
        let executionTime = TimeInterval(end.uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000_000
        
        // Mesure de l'utilisation mémoire
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        let memoryUsage = kerr == KERN_SUCCESS ? Int64(info.resident_size) : 0
        
        logger.info("Temps d'allocation: \(executionTime) secondes")
        logger.info("Utilisation mémoire: \(Double(memoryUsage) / 1_000_000) MB")
        
        return (executionTime, memoryUsage)
    }
    
    private static func measureStringPerformance() -> [(String, TimeInterval)] {
        logger.info("\n2. Test des Opérations sur les Chaînes")
        let testString = String(repeating: "Test de performance des chaînes. ", count: 1000)
        var stringResults = [(String, TimeInterval)]()
        
        autoreleasepool {
            let operations: [(String, @Sendable () -> Void)] = [
                ("split", { _ = testString.split(separator: " ") }),
                ("components", { _ = testString.components(separatedBy: " ") }),
                ("uppercase", { _ = testString.uppercased() })
            ]
            
            for (name, operation) in operations {
                let start = DispatchTime.now()
                operation()
                let end = DispatchTime.now()
                let time = TimeInterval(end.uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000_000
                stringResults.append((name, time))
            }
        }
        
        stringResults.forEach { name, time in
            logger.info("  - \(name): \(time) secondes")
        }
        
        return stringResults
    }
    
    private static func measureConcurrentPerformance() -> TimeInterval {
        logger.info("\n3. Test des Opérations Concurrentes")
        let group = DispatchGroup()
        let operationCount = 1000
        let semaphore = DispatchSemaphore(value: 50)
        
        actor OperationCounter {
            private var count = 0
            
            func increment() -> Int {
                count += 1
                return count
            }
        }
        
        let operationCounter = OperationCounter()
        let start = DispatchTime.now()
        
        @Sendable func performOperation() {
            semaphore.wait()
            defer { semaphore.signal() }
            
            Thread.sleep(forTimeInterval: 0.001)
            
            Task {
                let count = await operationCounter.increment()
                if count % 100 == 0 {
                    let progress = Double(count) / Double(operationCount) * 100
                    logger.info("Progression: \(Int(progress))%")
                }
            }
        }
        
        for _ in 0..<operationCount {
            group.enter()
            queue.async {
                performOperation()
                group.leave()
            }
        }
        
        group.wait()
        let end = DispatchTime.now()
        let executionTime = TimeInterval(end.uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000_000
        
        logger.info("Temps d'exécution: \(executionTime) secondes")
        return executionTime
    }
    
    private static func measureFileOperations() -> [(String, TimeInterval)] {
        logger.info("\n4. Test des Opérations Fichier")
        let testData = String(repeating: "Test de performance des opérations fichier.\n", count: 1000)
        let tempFile = (NSTemporaryDirectory() as NSString).appendingPathComponent("test_perf.txt")
        var ioResults = [(String, TimeInterval)]()
        
        do {
            // Test d'écriture
            let writeStart = DispatchTime.now()
            try testData.write(to: URL(fileURLWithPath: tempFile), atomically: true, encoding: .utf8)
            let writeTime = TimeInterval(DispatchTime.now().uptimeNanoseconds - writeStart.uptimeNanoseconds) / 1_000_000_000
            ioResults.append(("écriture", writeTime))
            
            // Test de lecture
            let readStart = DispatchTime.now()
            _ = try String(contentsOf: URL(fileURLWithPath: tempFile), encoding: .utf8)
            let readTime = TimeInterval(DispatchTime.now().uptimeNanoseconds - readStart.uptimeNanoseconds) / 1_000_000_000
            ioResults.append(("lecture", readTime))
            
            // Test de suppression
            let deleteStart = DispatchTime.now()
            try FileManager.default.removeItem(atPath: tempFile)
            let deleteTime = TimeInterval(DispatchTime.now().uptimeNanoseconds - deleteStart.uptimeNanoseconds) / 1_000_000_000
            ioResults.append(("suppression", deleteTime))
            
        } catch {
            logger.error("Erreur lors des opérations fichier: \(error.localizedDescription)")
        }
        
        ioResults.forEach { operation, time in
            logger.info("  - \(operation): \(time) secondes")
        }
        
        return ioResults
    }
    
    private static func printSummary(
        memoryTime: TimeInterval,
        memoryUsage: Int64,
        stringResults: [(String, TimeInterval)],
        concurrentTime: TimeInterval,
        fileResults: [(String, TimeInterval)]
    ) {
        let stringTime = stringResults.reduce(0.0) { $0 + $1.1 }
        let fileTime = fileResults.reduce(0.0) { $0 + $1.1 }
        
        logger.info("""
        
        📊 RÉSUMÉ DES PERFORMANCES
        -------------------------
        🔸 Allocation mémoire:
           - Temps: \(memoryTime) secondes
           - Utilisation: \(Double(memoryUsage) / 1_000_000) MB
        
        🔸 Opérations chaînes:
           - Temps total: \(stringTime) secondes
           \(stringResults.map { "   • \($0.0): \($0.1) secondes" }.joined(separator: "\n"))
        
        🔸 Opérations concurrentes:
           - Temps total: \(concurrentTime) secondes
        
        🔸 Opérations fichier:
           - Temps total: \(fileTime) secondes
           \(fileResults.map { "   • \($0.0): \($0.1) secondes" }.joined(separator: "\n"))
        
        ✨ Tests de performance terminés!
        """)
    }
}
