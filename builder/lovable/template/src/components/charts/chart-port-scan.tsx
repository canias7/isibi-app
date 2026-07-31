import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PortScan } from "@/components/charts/lib/netsec"
type S = "open" | "closed" | "filtered"
const hosts = ["10.0.1.10", "10.0.1.11", "10.0.1.12", "10.0.1.20", "10.0.1.21"]
const ports = [22, 80, 443, 3306, 5432, 6379, 8080]
const grid: S[][] = [
  ["open", "open", "open", "closed", "filtered", "closed", "closed"],
  ["open", "closed", "open", "filtered", "filtered", "closed", "open"],
  ["filtered", "closed", "open", "closed", "closed", "closed", "closed"],
  ["open", "open", "open", "open", "closed", "open", "closed"],
  ["closed", "closed", "filtered", "closed", "closed", "closed", "closed"],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open ports</CardTitle>
        <CardDescription>Filtered is not closed</CardDescription>
      </CardHeader>
      <CardContent>
        <PortScan hosts={hosts} ports={ports} grid={grid} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Filtered usually means a firewall in front <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Subnet sweep
        </div>
      </CardFooter>
    </Card>
  )
}
