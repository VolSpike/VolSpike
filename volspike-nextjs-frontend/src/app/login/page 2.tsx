import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Sign In - VolSpike',
    description: 'Sign in to VolSpike to access real-time volume spike alerts',
}

export default function LoginPageRoute() {
    redirect('/auth?tab=signin')
}
