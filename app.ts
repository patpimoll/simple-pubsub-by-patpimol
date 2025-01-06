//------------------------------interfaces----------------------------------------

interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  handle(event: IEvent): void;
}

interface IPublishSubscribeService {
  publish(event: IEvent): void;
  subscribe(type: string, handler: ISubscriber): void;
  unsubscribe(type: string, handler: ISubscriber): void;
}

//---------------------------implementations----------------------------------------

class MachineSaleEvent implements IEvent {
  constructor(private readonly _sold: number, private readonly _machineId: string) { }
  machineId(): string {
    return this._machineId;
  }
  getSoldQuantity(): number {
    return this._sold;
  }
  type(): string {
    return 'sale';
  }
}

class MachineRefillEvent implements IEvent {
  constructor(private readonly _refill: number, private readonly _machineId: string) { }
  machineId(): string {
    return this._machineId;
  }
  getRefillQuantity(): number {
    return this._refill;
  }
  type(): string {
    return 'refill';
  }
}

class LowStockWarningEvent implements IEvent {
  constructor(private readonly _machineID: string) { }
  type(): string {
    return 'low-stock-warning';
  }
  machineId(): string {
    return this._machineID;
  }
}

class StockLevel10Event implements IEvent {
  constructor(private readonly _machineID: string) { }
  type(): string {
    return 'stock-level-ok';
  }
  machineId(): string {
    return this._machineID;
  }
}

//-----------------------------Subscribers----------------------------------------

class MachineSaleSubscriber implements ISubscriber {
  private lowStockMachines = new Set<string>();

  constructor(private machines: Machine[], private pubSubService: IPublishSubscribeService) {}

  handle(event: IEvent): void {
    if (event instanceof MachineSaleEvent) {
      const machine = this.machines.find((m) => m.id === event.machineId());
      if (machine) {
        const soldQuantity = event.getSoldQuantity();
        if (soldQuantity <= machine.stockLevel) {
          machine.stockLevel -= soldQuantity;
          console.log(`Machine ${machine.id} sold ${soldQuantity} units, stock updated to: ${machine.stockLevel}`);

          if (machine.stockLevel < 3 && !this.lowStockMachines.has(machine.id)) {   // Stock less than 3
            this.lowStockMachines.add(machine.id);
            this.pubSubService.publish(new LowStockWarningEvent(machine.id));       // Low stock alert
          }
        } else {
          console.log(`Error: Machine ${machine.id} does not have enough stock to sell ${soldQuantity} units.`);
        }
      }
    }
  }
}

class MachineRefillSubscriber implements ISubscriber {
  private lowStockMachines = new Set<string>();

  constructor(private machines: Machine[], private pubSubService: IPublishSubscribeService) {}

  handle(event: IEvent): void {
    if (event instanceof MachineRefillEvent) {
      const machine = this.machines.find((m) => m.id === event.machineId());
      if (machine) {
        const initialStock = machine.stockLevel;
        let refillQuantity = event.getRefillQuantity();
        
        machine.stockLevel += refillQuantity;
        console.log(`Machine ${machine.id} stock refilled from ${initialStock} to ${machine.stockLevel}.`);
        
        if (machine.stockLevel >= 3 && this.lowStockMachines.has(machine.id)) {
          this.lowStockMachines.delete(machine.id);
          this.pubSubService.publish(new StockLevel10Event(machine.id));        // Normal stock alert
        }
      }
    }
  }
}

class StockWarningSubscriber implements ISubscriber{
  handle(event:IEvent):void{
      if (event instanceof LowStockWarningEvent){
          console.log(`Warning : machine ${event.machineId()} is low on stock!`);
      } else if(event instanceof StockLevel10Event){
          console.log(`Info : Machine stock level of ${event.machineId()} is back to normal.`);
      }
  }
}

//----------------------PublishSubscribeService----------------------------------------

class PublishSubscribeService implements IPublishSubscribeService {
  private subscribers: Map<string, ISubscriber[]> = new Map();

  publish(event: IEvent): void {
    const type = event.type();
    console.log(`Publishing event of type: ${type}`);
    const handlers = this.subscribers.get(type) || [];
    handlers.forEach((subscriber) => subscriber.handle(event));
  }

  subscribe(type: string, handler: ISubscriber): void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
      console.log(`Created new subscriber list for type: ${type}`);
    }
    this.subscribers.get(type)?.push(handler);
    console.log(`Subscriber added for type: ${type}`);
  }

  unsubscribe(type: string, handler: ISubscriber): void {
    const handlers = this.subscribers.get(type);
    if (handlers) {
      this.subscribers.set(
        type,
        handlers.filter((h) => h !== handler)
      );
    }
  }
}

//------------------------------Machine----------------------------------------

class Machine {
  public stockLevel = 10;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }
}

//------------------------------Helpers----------------------------------------

const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) return '001';
  if (random < 2) return '002';
  return '003';
};

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 2 : 8; 
    const event = new MachineSaleEvent(saleQty, randomMachine());
    console.log(`Generated event: Sale - Machine ${event.machineId()} - Qty: ${saleQty}`);
    return event;
  }
  const refillQty = Math.random() < 0.5 ? 3 : 6; 
  const event = new MachineRefillEvent(refillQty, randomMachine());
  console.log(`Generated event: Refill - Machine ${event.machineId()} - Qty: ${refillQty}`);
  return event;
};

//------------------------------Main Program----------------------------------------

(async () => {
  console.log("-".repeat(50));
  console.log("Program started...");
  const machines: Machine[] = [new Machine('001'), new Machine('002'), new Machine('003')];
  const PubSubService = new PublishSubscribeService();

  const saleSubscriber = new MachineSaleSubscriber(machines, PubSubService);
  const refillSubscriber = new MachineRefillSubscriber(machines, PubSubService);
  const stockSubscriber = new StockWarningSubscriber();
  console.log("-".repeat(50));

  PubSubService.subscribe('sale', saleSubscriber);
  //PubSubService.unsubscribe('sale', saleSubscriber);
  PubSubService.subscribe('refill', refillSubscriber);
  //PubSubService.unsubscribe('refill', refillSubscriber);
  PubSubService.subscribe('low-stock-warning', stockSubscriber);
  //PubSubService.unsubscribe('low-stock-warning', stockSubscriber);
  PubSubService.subscribe('stock-level-ok', stockSubscriber);
  //PubSubService.unsubscribe('stock-level-ok', stockSubscriber);
  console.log("-".repeat(50));

  console.log("Subscribers registered...");

  const events = Array.from({ length: 5 }, () => eventGenerator());  
  console.log("-".repeat(50));

  console.log("Generated events:", events);
  events.forEach((event) => {
    console.log(`Publishing event: ${event.type()} for Machine ID: ${event.machineId()}`);
    PubSubService.publish(event);
  });

  console.log("Event publishing completed.");
  console.log("-".repeat(50));
})();
