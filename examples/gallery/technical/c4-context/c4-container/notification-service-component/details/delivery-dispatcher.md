# Delivery Dispatcher

Actually sends the rendered content to the passenger. Deliberately the last, simplest link in the chain — if delivery fails, only this component needs to retry, not the whole notification pipeline.
