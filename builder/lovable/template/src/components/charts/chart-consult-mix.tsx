import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConsultMix } from "@/components/charts/lib/vet"
const types = [
  { name: "Vaccination", count: 214, meanMinutes: 8, p90Minutes: 10 },
  { name: "Post-op check", count: 96, meanMinutes: 7, p90Minutes: 11 },
  { name: "Repeat prescription", count: 131, meanMinutes: 6, p90Minutes: 9 },
  { name: "Lameness", count: 58, meanMinutes: 16, p90Minutes: 26 },
  { name: "Skin and itching", count: 74, meanMinutes: 14, p90Minutes: 22 },
  { name: "Sick animal, first visit", count: 88, meanMinutes: 13, p90Minutes: 24 },
  { name: "End of life", count: 19, meanMinutes: 32, p90Minutes: 45 },
  { name: "New puppy or kitten", count: 47, meanMinutes: 12, p90Minutes: 19 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consults</CardTitle>
        <CardDescription>Everything booked into ten minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <ConsultMix types={types} slotMinutes={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A longer slot, not a faster vet <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}
