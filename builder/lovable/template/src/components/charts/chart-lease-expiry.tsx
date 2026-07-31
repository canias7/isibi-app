import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LeaseExpiry } from "@/components/charts/lib/realestate"
const leases = [
  { tenant: "Northwind Legal", expiryYear: 2032, annualRent: 496000 },
  { tenant: "Kiln Software", expiryYear: 2027, annualRent: 254000 },
  { tenant: "Harbour Accountants", expiryYear: 2030, annualRent: 168000 },
  { tenant: "Fell Design", expiryYear: 2027, annualRent: 106000 },
  { tenant: "Ground floor café", expiryYear: 2035, annualRent: 62000 },
  { tenant: "Second floor suite", expiryYear: 2028, annualRent: 88000 },
  { tenant: "Storage", expiryYear: 2030, annualRent: 24000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>When leases fall due</CardTitle>
        <CardDescription>The expiry profile</CardDescription>
      </CardHeader>
      <CardContent>
        <LeaseExpiry leases={leases} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A cliff is the risk <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By year
        </div>
      </CardFooter>
    </Card>
  )
}
