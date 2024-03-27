// class for handling errors by logging them to the console.
class ErrorHandler {
    static handleError(error: Error): void {
      console.error('Error:', error.message);
    }
  }
  
  export default ErrorHandler;
  