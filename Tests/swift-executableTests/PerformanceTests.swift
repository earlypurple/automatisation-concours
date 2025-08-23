import XCTest

final class PerformanceTests: XCTestCase {
    // Test case to measure execution time
    func testExecutionPerformance() {
        measure {
            // TODO: Add your test code here
            _ = swift_executable.main()
        }
    }
    
    // Test memory allocation
    func testMemoryAllocation() {
        // Create an autorelease pool to manage memory
        autoreleasepool {
            var array: [Int] = []
            measure {
                // Allocate memory by adding elements
                for i in 0...10000 {
                    array.append(i)
                }
            }
        }
    }
    
    // Test concurrent operations
    func testConcurrentOperations() {
        let expectation = XCTestExpectation(description: "Concurrent operations")
        let operationCount = 1000
        let queue = DispatchQueue(label: "com.test.concurrent", attributes: .concurrent)
        
        measure {
            var completedOperations = 0
            for _ in 0..<operationCount {
                queue.async {
                    // Simulate some work
                    Thread.sleep(forTimeInterval: 0.001)
                    
                    DispatchQueue.main.async {
                        completedOperations += 1
                        if completedOperations == operationCount {
                            expectation.fulfill()
                        }
                    }
                }
            }
            
            wait(for: [expectation], timeout: 10.0)
        }
    }
    
    // Test file operations if needed
    func testFileOperations() {
        let fileManager = FileManager.default
        let testData = "Test data for performance measurement"
        let tempFile = NSTemporaryDirectory() + "test.txt"
        
        measure {
            // Write
            try? testData.write(toFile: tempFile, atomically: true, encoding: .utf8)
            
            // Read
            _ = try? String(contentsOfFile: tempFile, encoding: .utf8)
            
            // Delete
            try? fileManager.removeItem(atPath: tempFile)
        }
    }
    
    // Test string operations
    func testStringOperations() {
        let testString = String(repeating: "Test string for performance measurement. ", count: 1000)
        
        measure {
            _ = testString.components(separatedBy: " ")
            _ = testString.split(separator: " ")
            _ = testString.uppercased()
            _ = testString.lowercased()
        }
    }
    
    static var allTests = [
        ("testExecutionPerformance", testExecutionPerformance),
        ("testMemoryAllocation", testMemoryAllocation),
        ("testConcurrentOperations", testConcurrentOperations),
        ("testFileOperations", testFileOperations),
        ("testStringOperations", testStringOperations)
    ]
}
