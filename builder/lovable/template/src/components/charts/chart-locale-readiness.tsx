import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LocaleReadiness } from "@/components/charts/lib/translation"
const surfaces = [
  { name: "Home", strings: 120, weight: 26 },
  { name: "Catalogue", strings: 640, weight: 31 },
  { name: "Basket", strings: 180, weight: 18 },
  { name: "Checkout", strings: 210, weight: 14 },
  { name: "Account", strings: 380, weight: 7 },
  { name: "Help", strings: 1420, weight: 4 },
]
const locales = [
  { name: "German", translated: [120, 640, 180, 210, 380, 1180] },
  { name: "French", translated: [120, 640, 180, 210, 340, 860] },
  { name: "Spanish", translated: [120, 628, 176, 96, 310, 1240] },
  { name: "Italian", translated: [120, 512, 122, 61, 380, 1420] },
  { name: "Polish", translated: [118, 384, 96, 48, 190, 640] },
  { name: "Turkish", translated: [96, 210, 42, 18, 84, 210] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Locale readiness</CardTitle>
        <CardDescription>Weighted by where the strings are</CardDescription>
      </CardHeader>
      <CardContent>
        <LocaleReadiness locales={locales} surfaces={surfaces} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A fully translated product with an English checkout <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six locales
        </div>
      </CardFooter>
    </Card>
  )
}
