# Booking Client

The only component in this app that talks to the Booking API. Wraps every request/response with this app's own error handling and retry conventions, so the UI Layer never has to know it's talking to a remote service at all.
