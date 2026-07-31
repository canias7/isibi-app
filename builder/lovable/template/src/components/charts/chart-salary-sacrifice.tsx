import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SalarySacrifice } from "@/components/charts/lib/payroll"
const schemes = [
  { name: "Cycle to work", monthlyAmount: 62, retailPrice: 1100 },
  { name: "Electric car", monthlyAmount: 420, retailPrice: 7200 },
  { name: "Additional pension", monthlyAmount: 200 },
  { name: "Nursery", monthlyAmount: 340, retailPrice: 4080 },
  { name: "Technology", monthlyAmount: 55, retailPrice: 780 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Salary sacrifice</CardTitle>
        <CardDescription>What it is worth to both sides</CardDescription>
      </CardHeader>
      <CardContent>
        <SalarySacrifice
          schemes={schemes}
          salary={48000}
          marginalTaxRate={0.4}
          employeeNiRate={0.02}
          employerNiRate={0.138}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Reference pay is what a mortgage lender uses <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          £48,000, 40% band
        </div>
      </CardFooter>
    </Card>
  )
}
